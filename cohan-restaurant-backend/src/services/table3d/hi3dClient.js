import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const jobs = new Map();
const trim = (value) => String(value || "").trim();
const enabled = (value) => ["1", "true", "yes", "on"].includes(trim(value).toLowerCase());
const fetchWithTimeout = async (url, options = {}, timeoutMs = 60000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const getHi3dConfig = (env = process.env) => {
  const provider = trim(env.TABLE_3D_AI_PROVIDER || env.TABLE_3D_AI_FINAL_PROVIDER).toLowerCase();
  const clientId = trim(env.HI3D_CLIENT_ID || env.TABLE_3D_AI_CLIENT_ID);
  const clientSecret = trim(env.HI3D_CLIENT_SECRET || env.TABLE_3D_AI_CLIENT_SECRET);
  return {
    provider,
    isHi3d: ["hi3d", "hitem3d"].includes(provider),
    configured: enabled(env.TABLE_3D_AI_ENABLED) && ["hi3d", "hitem3d"].includes(provider) && Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    endpoint: trim(env.TABLE_3D_AI_ENDPOINT || env.HI3D_ENDPOINT || "https://api.hitem3d.ai").replace(/\/$/, ""),
    model: trim(env.TABLE_3D_AI_HI3D_MODEL || "hitem3dv2.1"),
    resolution: trim(env.TABLE_3D_AI_HI3D_RESOLUTION || "1536fast"),
    face: Math.min(2_000_000, Math.max(100_000, Number.parseInt(env.TABLE_3D_AI_HI3D_FACE || "300000", 10))),
    pbr: enabled(env.TABLE_3D_AI_HI3D_PBR ?? "true") ? 1 : 0,
    uploadDir: path.resolve(env.UPLOAD_DIR || path.join(process.cwd(), "uploads")),
    maxModelBytes: Number.parseInt(env.TABLE_3D_MODEL_MAX_FILE_SIZE_BYTES || `${15 * 1024 * 1024}`, 10),
  };
};

const readJson = async (response, action) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || Number(payload?.code) !== 200) {
    throw new Error(trim(payload?.msg || payload?.message) || `Hi3D ${action} failed with HTTP ${response.status}`);
  }
  return payload;
};

const getToken = async (config) => {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetchWithTimeout(`${config.endpoint}/open-api/v1/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json", "Content-Type": "application/json" },
  });
  const payload = await readJson(response, "token request");
  const token = trim(payload?.data?.accessToken);
  if (!token) throw new Error("Hi3D token response did not include accessToken");
  return token;
};

const submitForm = (images, config) => {
  if (images.length < 3 || images.length > 4) throw new Error("Hi3D requires 3 to 4 reference images");
  const form = new FormData();
  for (const image of images) {
    if (!image?.buffer?.length || image.buffer.length > 5 * 1024 * 1024) throw new Error("Invalid Hi3D reference image");
    form.append("multi_images", new Blob([image.buffer], { type: image.mimeType }), image.fileName || "reference.jpg");
  }
  form.append("request_type", "3");
  form.append("model", config.model);
  form.append("resolution", config.resolution);
  form.append("face", String(config.face));
  form.append("format", "2");
  form.append("pbr", String(config.pbr));
  return form;
};

export const submitHi3dJob = async ({ images, metadata = {}, userId, env = process.env }) => {
  const config = getHi3dConfig(env);
  if (!config.configured) return { ok: false, status: "not_configured", provider: "hi3d", message: "Add HI3D_CLIENT_ID and HI3D_CLIENT_SECRET." };
  const token = await getToken(config);
  const response = await fetchWithTimeout(`${config.endpoint}/open-api/v1/submit-task`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    body: submitForm(images, config),
  });
  const payload = await readJson(response, "task creation");
  const providerTaskId = trim(payload?.data?.task_id);
  if (!providerTaskId) throw new Error("Hi3D task response did not include task_id");
  const jobId = `hi3d-table3d-${crypto.randomUUID()}`;
  jobs.set(jobId, {
    jobId,
    providerTaskId,
    provider: "hi3d",
    aiProvider: "hi3d",
    userId: trim(userId),
    status: "queued",
    generationStatus: "queued",
    input: { ...metadata, images: [] },
    generatedModelUrl: "",
    generatedThumbnailUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true, status: "queued", jobId, providerTaskId, provider: "hi3d", aiProvider: "hi3d", message: "Hi3D generation task queued." };
};

const saveGlb = async (url, config) => {
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`Hi3D model download failed with HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > config.maxModelBytes) throw new Error("Hi3D model file is empty or too large");
  if (buffer.subarray(0, 4).toString("ascii") !== "glTF") throw new Error("Hi3D result is not a valid GLB file");
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.glb`;
  const dir = path.join(config.uploadDir, "table-3d", "models");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), buffer, { flag: "wx" });
  return `/uploads/table-3d/models/${fileName}`;
};

export const pollHi3dJob = async (jobId, { userId, env = process.env } = {}) => {
  const config = getHi3dConfig(env);
  const job = jobs.get(trim(jobId));
  if (!config.configured) return { ok: false, status: "not_configured", provider: "hi3d" };
  if (!job || (job.userId && job.userId !== trim(userId))) return { ok: false, status: "failed", provider: "hi3d", message: "Hi3D generation job was not found." };
  if (["completed", "failed"].includes(job.status)) return { ...job, ok: true };
  const token = await getToken(config);
  const query = new URLSearchParams({ task_id: job.providerTaskId });
  const response = await fetchWithTimeout(`${config.endpoint}/open-api/v1/query-task?${query}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const payload = await readJson(response, "task query");
  const state = trim(payload?.data?.state).toLowerCase();
  if (["created", "queueing", "processing"].includes(state)) {
    job.status = state === "processing" ? "processing" : "queued";
    job.generationStatus = job.status;
  } else if (state === "success" && payload?.data?.url) {
    job.status = job.generationStatus = "completed";
    job.generatedModelUrl = await saveGlb(payload.data.url, config);
    job.generatedThumbnailUrl = trim(payload?.data?.cover_url);
    job.progress = 100;
  } else if (state === "failed") {
    job.status = job.generationStatus = "failed";
    job.message = trim(payload?.msg) || "Hi3D generation failed";
  }
  job.updatedAt = new Date().toISOString();
  return { ...job, ok: true };
};

export const clearHi3dJobsForTests = () => jobs.clear();
