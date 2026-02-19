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

const MAX_FILE_SIZE_BYTES = Number.parseInt(
  process.env.UPLOAD_MAX_FILE_SIZE_BYTES || `${10 * 1024 * 1024}`,
  10
);
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
        limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 1 },
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

      app.post("/upload", async function (req, reply) {
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
      const key = `${s3.keyPrefix}/${randomName(ext)}`;

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
      const { key } = req.body || {};
      if (!key) {
        return reply.code(400).send({ ok: false, message: "Missing key" });
      }

      return reply.send({ ok: true, key, url: `${s3.publicBase}/${key}`, storage: "s3" });
    });

    app.get("/_probe", async () => ({ ok: true, route: "upload", storage: "s3" }));
  },
  { name: "upload-routes", fastify: "4.x || 5.x" }
);
