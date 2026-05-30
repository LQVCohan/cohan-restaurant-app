// src/plugins/upload.route.js
import fp from "fastify-plugin";
import multipart from "@fastify/multipart";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import fastifyStatic from "@fastify/static";
import process from "node:process";
import sharp from "sharp";
import { URL } from "node:url";
import { resolveAuthenticatedUserFromRequest } from "../authUserResolver.js";

const MAX_FILE_SIZE_BYTES = Number.parseInt(
  process.env.UPLOAD_MAX_FILE_SIZE_BYTES || `${10 * 1024 * 1024}`,
  10
);
const TABLE_3D_MODEL_MAX_FILE_SIZE_BYTES = Number.parseInt(
  process.env.TABLE_3D_MODEL_MAX_FILE_SIZE_BYTES || `${15 * 1024 * 1024}`,
  10
);
const TABLE_3D_THUMBNAIL_MAX_FILE_SIZE_BYTES = Number.parseInt(
  process.env.TABLE_3D_THUMBNAIL_MAX_FILE_SIZE_BYTES || `${3 * 1024 * 1024}`,
  10
);
const TABLE_3D_MAX_MULTIPART_FILE_SIZE_BYTES = Math.max(
  MAX_FILE_SIZE_BYTES,
  TABLE_3D_MODEL_MAX_FILE_SIZE_BYTES,
  TABLE_3D_THUMBNAIL_MAX_FILE_SIZE_BYTES
);
const TABLE_3D_MODEL_EXTENSIONS = new Set([".glb"]);
const TABLE_3D_MODEL_MIME_TYPES = new Set([
  "model/gltf-binary",
  "application/octet-stream",
]);
const TABLE_3D_THUMBNAIL_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const ALLOWED_MIME_TYPES = new Set(
  (process.env.UPLOAD_ALLOWED_MIME_TYPES ||
    "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean)
);
const TEMP_FILE_RETENTION_MS = Number.parseInt(
  process.env.UPLOAD_TEMP_RETENTION_MS || `${24 * 60 * 60 * 1000}`,
  10
);

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

const buildPublicBase = (req) =>
  process.env.PUBLIC_BASE_URL ||
  `${req.protocol}://${req.headers["x-forwarded-host"] || req.headers.host}`;

const isDevelopmentMode = () => (process.env.UPLOAD_MODE || "local") === "local";

const assertMimeAndSize = (file, fileSize) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    const allowed = Array.from(ALLOWED_MIME_TYPES).join(", ");
    throw new Error(`Unsupported MIME type '${file.mimetype}'. Allowed: ${allowed}`);
  }
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File exceeds max size of ${MAX_FILE_SIZE_BYTES} bytes`);
  }
};

const randomName = (ext = "webp") =>
  `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;

const sanitizeFileBaseName = (filename = "asset") => {
  const parsed = path.parse(String(filename || "asset"));
  const safeBase = parsed.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return safeBase || "asset";
};

const buildSafeAssetName = (filename, ext) =>
  `${Date.now()}-${crypto.randomBytes(8).toString("hex")}-${sanitizeFileBaseName(filename)}${ext}`;

const getCleanExtension = (filename = "") =>
  path.extname(String(filename || "").split(/[?#]/)[0]).toLowerCase();

const assertNoUnsafeUploadName = (filename = "") => {
  const raw = String(filename || "");
  if (!raw || raw.includes("/") || raw.includes("\\") || raw.split(/[\\/]/).some((part) => part === "..")) {
    throw new Error("Invalid file name");
  }
};

const validateTable3DModelFile = (file, buffer) => {
  assertNoUnsafeUploadName(file.filename);
  const ext = getCleanExtension(file.filename);
  if (!TABLE_3D_MODEL_EXTENSIONS.has(ext)) {
    throw new Error("Only .glb table 3D model files are supported in this phase");
  }
  if (!TABLE_3D_MODEL_MIME_TYPES.has(String(file.mimetype || "").toLowerCase())) {
    throw new Error("Unsupported table 3D model MIME type");
  }
  if (!buffer.length || buffer.length > TABLE_3D_MODEL_MAX_FILE_SIZE_BYTES) {
    throw new Error(`Model file exceeds max size of ${TABLE_3D_MODEL_MAX_FILE_SIZE_BYTES} bytes`);
  }
  return ext;
};

const validateTable3DThumbnailFile = (file, buffer) => {
  assertNoUnsafeUploadName(file.filename);
  const ext = getCleanExtension(file.filename);
  const mimeType = String(file.mimetype || "").toLowerCase();
  const extByMime = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
  };
  if (!TABLE_3D_THUMBNAIL_MIME_TYPES.has(mimeType)) {
    throw new Error("Thumbnail must be PNG, JPEG, or WebP");
  }
  if (!buffer.length || buffer.length > TABLE_3D_THUMBNAIL_MAX_FILE_SIZE_BYTES) {
    throw new Error(`Thumbnail exceeds max size of ${TABLE_3D_THUMBNAIL_MAX_FILE_SIZE_BYTES} bytes`);
  }
  if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    throw new Error("Thumbnail file extension must be .png, .jpg, .jpeg, or .webp");
  }
  return extByMime[mimeType] || ext;
};


const normalizePrefix = (prefix = "") =>
  prefix
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

const cleanupTempUploads = async (tempDir, logger) => {
  try {
    await ensureDir(tempDir);
    const entries = await fs.readdir(tempDir, { withFileTypes: true });
    const now = Date.now();
    await Promise.all(
      entries
        .filter((entry) => entry.isFile())
        .map(async (entry) => {
          const filePath = path.join(tempDir, entry.name);
          const stat = await fs.stat(filePath);
          if (now - stat.mtimeMs > TEMP_FILE_RETENTION_MS) {
            await fs.unlink(filePath).catch(() => {});
          }
        })
    );
  } catch (err) {
    logger?.warn({ err }, "temp file cleanup failed");
  }
};

const sha256Hex = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

const hmac = (key, value, encoding) =>
  crypto.createHmac("sha256", key).update(value).digest(encoding);


const UPLOAD_RATE_LIMIT_MAX = Number.parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || "30", 10);
const UPLOAD_RATE_LIMIT_WINDOW_MS = Number.parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || `${60 * 1000}`, 10);
// In-memory limiter is acceptable for single-instance/dev only.
// In multi-instance production, use a shared store (e.g. Redis) or shared @fastify/rate-limit backend.
const uploadRateStore = new Map();

const ensureUploadAuth = async (req, reply) => {
  const authUser = await resolveAuthenticatedUserFromRequest(req);
  if (!authUser?.id) {
    reply.code(401).send({ ok: false, message: "Unauthorized" });
    return null;
  }
  return authUser;
};

const consumeUploadRateLimit = (req, userId) => {
  const now = Date.now();
  const key = `${userId}:${req.ip}`;
  const bucket = uploadRateStore.get(key) || { count: 0, resetAt: now + UPLOAD_RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + UPLOAD_RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  uploadRateStore.set(key, bucket);
  return bucket.count <= UPLOAD_RATE_LIMIT_MAX;
};

const normalizeObjectKey = (value = "") => String(value).trim().replace(/^\/+/, "");

const hasUnsafePathSegments = (key = "") => key.split("/").some((part) => !part || part === "." || part === "..");

const buildUserScopedUploadPrefix = (basePrefix, userId) => `${normalizePrefix(basePrefix)}/${String(userId || "").trim()}/`;

const createS3Context = () => {
  const bucket = process.env.S3_BUCKET;
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const region = process.env.S3_REGION || "auto";

  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3_BUCKET, S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY are required when UPLOAD_MODE=s3"
    );
  }

  const endpointUrl = new URL(endpoint);
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";
  const keyPrefix = normalizePrefix(process.env.S3_UPLOAD_PREFIX || "uploads");
  const signedUrlExpiresSec = Number.parseInt(
    process.env.S3_SIGNED_URL_EXPIRES_SEC || "900",
    10
  );

  return {
    bucket,
    endpointUrl,
    accessKeyId,
    secretAccessKey,
    region,
    forcePathStyle,
    keyPrefix,
    signedUrlExpiresSec,
    publicBase: (
      process.env.S3_PUBLIC_BASE_URL ||
      `${endpointUrl.origin}/${bucket}`
    ).replace(/\/$/, ""),
  };
};

const buildSignedPutUrl = ({ s3, key, mimeType }) => {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${s3.region}/s3/aws4_request`;

  const host = s3.endpointUrl.host;
  const canonicalUri = s3.forcePathStyle
    ? `/${s3.bucket}/${key}`
    : `/${key}`;

  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${s3.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(s3.signedUrlExpiresSec),
    "X-Amz-SignedHeaders": "content-type;host",
  });

  const canonicalHeaders = `content-type:${mimeType}\nhost:${host}\n`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    query.toString(),
    canonicalHeaders,
    "content-type;host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const kDate = hmac(`AWS4${s3.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, s3.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, stringToSign, "hex");
  query.set("X-Amz-Signature", signature);

  const signedUrl = new URL(s3.endpointUrl.toString());
  signedUrl.pathname = s3.forcePathStyle
    ? `/${s3.bucket}/${key}`
    : `/${key}`;
  signedUrl.search = query.toString();
  return signedUrl.toString();
};

export default fp(
  async function uploadRoutes(app) {
    if (!app.hasContentTypeParser("multipart")) {
      await app.register(multipart, {
        limits: { fileSize: TABLE_3D_MAX_MULTIPART_FILE_SIZE_BYTES, files: 2 },
        attachFieldsToBody: false,
      });
    }

    const tempDir = path.resolve(
      process.env.UPLOAD_TEMP_DIR || path.join(os.tmpdir(), "cohan-uploads")
    );
    await cleanupTempUploads(tempDir, app.log);
    setInterval(() => {
      cleanupTempUploads(tempDir, app.log);
    }, TEMP_FILE_RETENTION_MS).unref();

    if (isDevelopmentMode()) {
      const uploadRoot = path.resolve(
        process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads")
      );
      await ensureDir(uploadRoot);

      await app.register(fastifyStatic, {
        root: uploadRoot,
        prefix: "/uploads/",
        decorateReply: false,
        setHeaders(res) {
          res.setHeader("Access-Control-Allow-Origin", "*");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        },
      });


      app.post("/table-3d-assets/upload", async function (req, reply) {
        const authUser = await ensureUploadAuth(req, reply);
        if (!authUser) return;
        if (!consumeUploadRateLimit(req, authUser.id)) {
          return reply.code(429).send({ ok: false, message: "Too many upload requests" });
        }

        const savedPaths = [];
        try {
          const modelDir = path.join(uploadRoot, "table-3d", "models");
          const thumbnailDir = path.join(uploadRoot, "table-3d", "thumbnails");
          await ensureDir(modelDir);
          await ensureDir(thumbnailDir);

          let modelPayload = null;
          let thumbnailPayload = null;

          for await (const part of req.parts()) {
            if (part.type !== "file") continue;
            if (part.fieldname !== "model" && part.fieldname !== "thumbnail") {
              await part.toBuffer();
              return reply.code(400).send({ ok: false, message: "Unsupported upload field" });
            }

            const buffer = await part.toBuffer();
            if (part.fieldname === "model") {
              if (modelPayload) {
                return reply.code(400).send({ ok: false, message: "Only one model file is allowed" });
              }
              const ext = validateTable3DModelFile(part, buffer);
              modelPayload = { file: part, buffer, ext };
              continue;
            }

            if (thumbnailPayload) {
              return reply.code(400).send({ ok: false, message: "Only one thumbnail file is allowed" });
            }
            const ext = validateTable3DThumbnailFile(part, buffer);
            thumbnailPayload = { file: part, buffer, ext };
          }

          if (!modelPayload) {
            return reply.code(400).send({ ok: false, message: "Model .glb file is required" });
          }

          const modelFileName = buildSafeAssetName(modelPayload.file.filename, modelPayload.ext);
          const modelPath = path.join(modelDir, modelFileName);
          await fs.writeFile(modelPath, modelPayload.buffer, { flag: "wx" });
          savedPaths.push(modelPath);

          let thumbnailUrl = "";
          if (thumbnailPayload) {
            const thumbnailFileName = buildSafeAssetName(thumbnailPayload.file.filename, thumbnailPayload.ext);
            const thumbnailPath = path.join(thumbnailDir, thumbnailFileName);
            await fs.writeFile(thumbnailPath, thumbnailPayload.buffer, { flag: "wx" });
            savedPaths.push(thumbnailPath);
            thumbnailUrl = `${buildPublicBase(req)}/uploads/table-3d/thumbnails/${thumbnailFileName}`;
          }

          return reply.send({
            ok: true,
            modelUrl: `${buildPublicBase(req)}/uploads/table-3d/models/${modelFileName}`,
            thumbnailUrl,
            fileName: modelFileName,
            originalFileName: modelPayload.file.filename,
            sizeBytes: modelPayload.buffer.length,
            maxModelSizeBytes: TABLE_3D_MODEL_MAX_FILE_SIZE_BYTES,
            maxThumbnailSizeBytes: TABLE_3D_THUMBNAIL_MAX_FILE_SIZE_BYTES,
            storage: "local",
          });
        } catch (err) {
          await Promise.all(savedPaths.map((filePath) => fs.unlink(filePath).catch(() => {})));
          req.log.error({ err }, "table 3d asset upload failed");
          return reply.code(400).send({
            ok: false,
            message: err?.message || "Invalid table 3D asset upload",
          });
        }
      });

      app.post("/upload", async function (req, reply) {
        const authUser = await ensureUploadAuth(req, reply);
        if (!authUser) return;
        if (!consumeUploadRateLimit(req, authUser.id)) {
          return reply.code(429).send({ ok: false, message: "Too many upload requests" });
        }
        try {
          const data = await req.file();
          if (!data) {
            return reply.code(400).send({ ok: false, message: "No file" });
          }

          const buffer = await data.toBuffer();
          assertMimeAndSize(data, buffer.length);

          const outName = randomName();
          const target = path.join(uploadRoot, outName);
          await sharp(buffer).rotate().webp({ quality: 80 }).toFile(target);

          return reply.send({
            ok: true,
            url: `${buildPublicBase(req)}/uploads/${outName}`,
            file: outName,
            storage: "local",
          });
        } catch (err) {
          req.log.error({ err }, "upload failed");
          return reply.code(400).send({
            ok: false,
            message:
              err?.message || "Invalid image format. Please upload a valid image.",
          });
        }
      });

      app.get("/_probe", async () => ({ ok: true, route: "upload", storage: "local" }));
      return;
    }

    const s3 = createS3Context();

    app.post("/upload/sign", async function (req, reply) {
      const authUser = await ensureUploadAuth(req, reply);
      if (!authUser) return;
      if (!consumeUploadRateLimit(req, authUser.id)) {
        return reply.code(429).send({ ok: false, message: "Too many upload requests" });
      }
      const body = req.body || {};
      const mimeType = String(body.mimeType || "").trim();
      const fileSize = Number.parseInt(String(body.fileSize || "0"), 10);

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        return reply
          .code(400)
          .send({ ok: false, message: `Unsupported MIME type '${mimeType}'` });
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
        return reply.code(400).send({ ok: false, message: "Invalid file size" });
      }

      const requestedExt = String(body.extension || "").trim().toLowerCase();
      const ext = requestedExt || mimeType.split("/")[1] || "bin";
      const userPrefix = buildUserScopedUploadPrefix(s3.keyPrefix, authUser.id);
      const key = `${userPrefix}${randomName(ext)}`;

      return reply.send({
        ok: true,
        method: "PUT",
        uploadUrl: buildSignedPutUrl({ s3, key, mimeType }),
        key,
        headers: { "Content-Type": mimeType },
        maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
        publicUrl: `${s3.publicBase}/${key}`,
        expiresInSec: s3.signedUrlExpiresSec,
        storage: "s3",
      });
    });

    app.post("/upload/complete", async function (req, reply) {
      const authUser = await ensureUploadAuth(req, reply);
      if (!authUser) return;
      if (!consumeUploadRateLimit(req, authUser.id)) {
        return reply.code(429).send({ ok: false, message: "Too many upload requests" });
      }
      const { key } = req.body || {};
      if (!key) {
        return reply.code(400).send({ ok: false, message: "Missing key" });
      }

      const normalizedKey = normalizeObjectKey(key);
      if (!normalizedKey || hasUnsafePathSegments(normalizedKey)) {
        return reply.code(400).send({ ok: false, message: "Invalid upload key" });
      }

      const allowedBasePrefix = `${normalizePrefix(s3.keyPrefix)}/`;
      if (!normalizedKey.startsWith(allowedBasePrefix)) {
        return reply.code(400).send({ ok: false, message: "Invalid upload key" });
      }

      const userScopedPrefix = buildUserScopedUploadPrefix(s3.keyPrefix, authUser.id);
      if (!normalizedKey.startsWith(userScopedPrefix)) {
        return reply.code(403).send({ ok: false, message: "Forbidden upload key" });
      }

      return reply.send({ ok: true, key: normalizedKey, url: `${s3.publicBase}/${normalizedKey}`, storage: "s3" });
    });

    app.get("/_probe", async () => ({ ok: true, route: "upload", storage: "s3" }));
  },
  { name: "upload-routes", fastify: "4.x || 5.x" }
);
