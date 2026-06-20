import fs from "fs";
import path from "path";
import process from "process";
import { Buffer } from "buffer";
import { GraphQLError } from "graphql";

const AVATAR_ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const AVATAR_MAX_FILE_SIZE_BYTES = Number(
  process.env.AVATAR_MAX_FILE_SIZE_BYTES || 2 * 1024 * 1024,
);
const LOCAL_AVATAR_PREFIX = "/uploads/avatars/";

const badInput = (message) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });

const ensureDirSync = (directory) => {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
};

const hasPathTraversal = (pathname = "") =>
  pathname.split("/").some((part) => part === "..");

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
    if (!rawUrl.startsWith("/uploads/") || hasPathTraversal(rawUrl)) {
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
        position: "centre",
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    throw badInput("Không thể xử lý tệp ảnh đã chọn.");
  }

  const uploadsDir = path.join(process.cwd(), "uploads", "avatars");
  ensureDirSync(uploadsDir);

  const safeUserId = String(userId || "user").replace(/[^a-zA-Z0-9_-]/g, "");
  const filename = `${safeUserId}-${Date.now()}.webp`;
  fs.writeFileSync(path.join(uploadsDir, filename), optimized);

  return `${LOCAL_AVATAR_PREFIX}${filename}`;
}

export function deleteLocalAvatar(avatarUrl) {
  const normalized = String(avatarUrl || "").trim();
  if (!normalized.startsWith(LOCAL_AVATAR_PREFIX) || hasPathTraversal(normalized)) {
    return false;
  }

  const filename = path.basename(normalized);
  const absolutePath = path.join(process.cwd(), "uploads", "avatars", filename);
  const expectedDirectory = path.join(process.cwd(), "uploads", "avatars");
  if (path.dirname(absolutePath) !== expectedDirectory) return false;

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

export { AVATAR_MAX_FILE_SIZE_BYTES, LOCAL_AVATAR_PREFIX };
