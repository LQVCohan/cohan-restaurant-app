import fs from "fs";
import path from "path";
import process from "process";
import { Buffer } from "buffer";
import { GraphQLError } from "graphql";

const AVATAR_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MAX_FILE_SIZE_BYTES = Number(
  process.env.AVATAR_MAX_FILE_SIZE_BYTES || 2 * 1024 * 1024,
);
const LOCAL_UPLOAD_PREFIX = "/uploads/";
const LOCAL_AVATAR_PREFIX = "/uploads/avatars/";

const badInput = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

const ensureDirSync = (directory) => {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
};

const getUploadRoot = () =>
  path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

const getAvatarDirectory = () => path.join(getUploadRoot(), "avatars");

const hasPathTraversal = (pathname = "") =>
  pathname.split("/").some((part) => part === "..");

const resolveLocalAvatarPath = (avatarUrl) => {
  const normalized = String(avatarUrl || "").trim();
  if (!normalized.startsWith(LOCAL_UPLOAD_PREFIX) || hasPathTraversal(normalized)) {
    return null;
  }

  const relativePath = normalized.slice(LOCAL_UPLOAD_PREFIX.length);
  if (!relativePath || relativePath.startsWith("/") || relativePath.includes("\\")) {
    return null;
  }

  const segments = relativePath.split("/").filter(Boolean);
  const isDedicatedAvatar =
    segments.length === 2 && segments[0] === "avatars";
  const isRootUpload = segments.length === 1;
  if (!isDedicatedAvatar && !isRootUpload) return null;

  const uploadRoot = getUploadRoot();
  const absolutePath = path.resolve(uploadRoot, ...segments);
  const relativeToRoot = path.relative(uploadRoot, absolutePath);
  if (
    relativeToRoot.startsWith("..") ||
    path.isAbsolute(relativeToRoot) ||
    !relativeToRoot
  ) {
    return null;
  }

  return absolutePath;
};

export function normalizeAvatarFileUrl(rawInputUrl) {
  const rawUrl = String(rawInputUrl || "").trim();
  const lower = rawUrl.toLowerCase();

  if (
    !rawUrl ||
    rawUrl.startsWith("//") ||
    lower.startsWith("javascript:") ||
    lower.startsWith("data:")
  ) {
    throw badInput("Đường dẫn ảnh đại diện không hợp lệ.");
  }

  if (rawUrl.startsWith("/")) {
    if (!rawUrl.startsWith(LOCAL_UPLOAD_PREFIX) || hasPathTraversal(rawUrl)) {
      throw badInput("Đường dẫn ảnh đại diện không được hỗ trợ.");
    }
    return rawUrl;
  }

  const s3BaseRaw = String(process.env.S3_PUBLIC_BASE_URL || "").trim();
  if (!s3BaseRaw) {
    throw badInput("Đường dẫn ảnh ngoài hệ thống không được hỗ trợ.");
  }

  let base;
  let target;
  try {
    base = new URL(s3BaseRaw);
    target = new URL(rawUrl);
  } catch {
    throw badInput("Đường dẫn ảnh đại diện không hợp lệ.");
  }

  if (target.origin !== base.origin) {
    throw badInput("Đường dẫn ảnh ngoài hệ thống không được hỗ trợ.");
  }

  const normalizedBasePath = base.pathname.endsWith("/")
    ? base.pathname
    : `${base.pathname}/`;
  if (
    !target.pathname.startsWith(normalizedBasePath) ||
    hasPathTraversal(target.pathname)
  ) {
    throw badInput("Đường dẫn ảnh đại diện không được hỗ trợ.");
  }

  return target.toString();
}

export async function saveBase64Avatar(fileBase64, userId) {
  if (String(process.env.UPLOAD_MODE || "local").toLowerCase() !== "local") {
    throw badInput(
      "Máy chủ đang dùng lưu trữ đám mây. Vui lòng tải ảnh qua dịch vụ upload trước.",
    );
  }

  const match = String(fileBase64 || "").match(
    /^data:(image\/[a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=]+)$/,
  );
  if (!match) throw badInput("Định dạng ảnh đại diện không hợp lệ.");

  const mimeType = match[1].toLowerCase();
  if (!AVATAR_ALLOWED_MIME.has(mimeType)) {
    throw badInput("Chỉ hỗ trợ ảnh JPG, PNG hoặc WEBP.");
  }

  const rawBuffer = Buffer.from(match[2], "base64");
  if (!rawBuffer.length) throw badInput("Tệp ảnh đại diện bị rỗng.");
  if (rawBuffer.length > AVATAR_MAX_FILE_SIZE_BYTES) {
    throw badInput("Ảnh đại diện không được vượt quá 2 MB.");
  }

  const { default: sharp } = await import("sharp");
  let optimized;
  try {
    optimized = await sharp(rawBuffer)
      .rotate()
      .resize(512, 512, {
        fit: "cover",
        position: "center",
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    throw badInput("Không thể xử lý tệp ảnh đã chọn.");
  }

  const uploadsDir = getAvatarDirectory();
  ensureDirSync(uploadsDir);

  const safeUserId = String(userId || "user").replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `${safeUserId}-${Date.now()}.webp`;
  fs.writeFileSync(path.join(uploadsDir, filename), optimized, { flag: "wx" });

  return `${LOCAL_AVATAR_PREFIX}${filename}`;
}

export function deleteLocalAvatar(avatarUrl) {
  const absolutePath = resolveLocalAvatarPath(avatarUrl);
  if (!absolutePath) return false;

  try {
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function resolveAvatarUpdate({ input = {}, userId }) {
  const fileBase64 = String(input.fileBase64 || "").trim();
  const fileUrl = String(input.fileUrl || "").trim();

  if (fileBase64 && fileUrl) {
    throw badInput("Chỉ được gửi tệp ảnh hoặc đường dẫn ảnh, không gửi đồng thời.");
  }

  if (fileBase64) return saveBase64Avatar(fileBase64, userId);
  if (fileUrl) return normalizeAvatarFileUrl(fileUrl);
  return null;
}

export {
  AVATAR_MAX_FILE_SIZE_BYTES,
  LOCAL_AVATAR_PREFIX,
  LOCAL_UPLOAD_PREFIX,
  getAvatarDirectory,
  getUploadRoot,
  resolveLocalAvatarPath,
};
