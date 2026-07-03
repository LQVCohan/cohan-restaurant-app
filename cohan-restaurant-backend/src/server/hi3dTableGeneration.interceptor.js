import { resolveAuthenticatedUserFromRequest } from "./authUserResolver.js";
import { getHi3dConfig, pollHi3dJob, submitHi3dJob } from "../services/table3d/hi3dClient.js";

const rateStore = new Map();
const consumeRateLimit = (req, userId) => {
  const now = Date.now();
  const max = Number.parseInt(process.env.TABLE_3D_AI_RATE_LIMIT_MAX || "10", 10);
  const windowMs = Number.parseInt(process.env.TABLE_3D_AI_RATE_LIMIT_WINDOW_MS || `${60 * 1000}`, 10);
  const key = `${userId}:${req.ip}:hi3d`;
  const bucket = rateStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) Object.assign(bucket, { count: 0, resetAt: now + windowMs });
  bucket.count += 1;
  rateStore.set(key, bucket);
  return bucket.count <= max;
};

const parseMetadata = (value) => {
  if (!value) return {};
  const parsed = JSON.parse(String(value));
  return parsed && typeof parsed === "object" ? parsed : {};
};

const readGenerationRequest = async (req) => {
  let metadata = {};
  const images = [];
  for await (const part of req.parts()) {
    if (part.type === "field") {
      if (part.fieldname === "metadata") metadata = parseMetadata(part.value);
      continue;
    }
    if (part.type !== "file") continue;
    if (part.fieldname !== "images") {
      await part.toBuffer();
      throw new Error("Unsupported AI image upload field");
    }
    images.push({
      buffer: await part.toBuffer(),
      fileName: part.filename,
      mimeType: part.mimetype,
    });
  }
  return { images, metadata };
};

export const registerHi3dTableGenerationInterceptor = (app) => {
  app.addHook("preHandler", async (req, reply) => {
    const config = getHi3dConfig(process.env);
    if (!config.isHi3d) return;

    const pathname = new URL(req.raw.url, "http://localhost").pathname;
    const generateRoute = req.method === "POST" && pathname === "/api/table-3d-ai/generate";
    const jobRoute = req.method === "GET" && pathname.match(/^\/api\/table-3d-ai\/jobs\/([^/]+)$/);
    if (!generateRoute && !jobRoute) return;

    const user = await resolveAuthenticatedUserFromRequest(req).catch(() => null);
    if (!user?.id) return reply.code(401).send({ ok: false, message: "Unauthorized" });
    if (!consumeRateLimit(req, user.id)) return reply.code(429).send({ ok: false, message: "Too many AI generation requests" });

    try {
      const result = generateRoute
        ? await submitHi3dJob({ ...(await readGenerationRequest(req)), userId: user.id })
        : await pollHi3dJob(decodeURIComponent(jobRoute[1]), { userId: user.id });
      return reply.code(result.ok ? 200 : 503).send(result);
    } catch (error) {
      req.log.error({ err: error }, "hi3d table generation failed");
      return reply.code(400).send({
        ok: false,
        status: "provider_error",
        provider: "hi3d",
        message: error?.message || "Hi3D request failed",
      });
    }
  });
};
