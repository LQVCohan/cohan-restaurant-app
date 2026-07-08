import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const CONFIG_REQUIRED_MESSAGE = "AI 3D generation provider is not configured";
const PENDING_PROVIDER_MESSAGE = "AI 3D generation provider adapter is pending implementation";
const PROMPT_READY_MESSAGE =
  "Ollama/Gemini prompt pipeline is ready, but no GLB model is generated until a real 3D generation engine/provider is connected.";
const MOCK_PROVIDER = "mock";
const OLLAMA_PROVIDER = "ollama";
const GEMINI_PROVIDER = "gemini";
const MESHY_PROVIDER = "meshy";
const HI3D_PROVIDER = "hi3d";
const DEFAULT_OLLAMA_ENDPOINT = "http://localhost:11434";
const DEFAULT_OLLAMA_MODEL = "llava";
const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";
const DEFAULT_HI3D_ENDPOINT = "https://api.hitem3d.ai";
const DEFAULT_HI3D_MODEL = "hitem3dv2.1";
const DEFAULT_HI3D_RESOLUTION = "1536fast";
const DEFAULT_HI3D_FACE_COUNT = 200000;
const HYBRID_PROVIDER_ALIASES = new Set(["ollama-gemini", "ollama_gemini", "hybrid", "local-gemini"]);
const HI3D_PROVIDER_ALIASES = new Set([HI3D_PROVIDER, "hitem3d"]);
const jobStore = new Map();

const normalizeBoolean = (value) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
const trim = (value) => String(value || "").trim();
const normalizeProviderName = (value) => trim(value).toLowerCase();
const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags.map(String).map((tag) => tag.trim()).filter(Boolean);
  return String(tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
};
const normalizeDimensions = (dimensions = {}) => ["width", "depth", "height", "diameter"].reduce((acc, key) => {
  const value = dimensions[key] ?? dimensions[`${key}Cm`];
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) acc[key] = parsed;
  return acc;
}, {});
const normalizeIntegerInRange = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

const omitImagePayloads = (input = {}) => ({ ...input, images: [] });

const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export const getTable3DAiProviderConfig = (env = process.env) => {
  const rawProvider = normalizeProviderName(env.TABLE_3D_AI_PROVIDER || env.TABLE_3D_AI_FINAL_PROVIDER);
  const isHybridAlias = HYBRID_PROVIDER_ALIASES.has(rawProvider);
  const isHi3dAlias = HI3D_PROVIDER_ALIASES.has(rawProvider);
  const provider = isHybridAlias ? GEMINI_PROVIDER : isHi3dAlias ? HI3D_PROVIDER : rawProvider;
  const enabled = normalizeBoolean(env.TABLE_3D_AI_ENABLED);
  const apiKey = trim(provider === GEMINI_PROVIDER ? env.TABLE_3D_AI_API_KEY || env.GEMINI_API_KEY || env.GOOGLE_API_KEY : env.TABLE_3D_AI_API_KEY);
  const endpoint = trim(env.TABLE_3D_AI_ENDPOINT) || (provider === HI3D_PROVIDER ? DEFAULT_HI3D_ENDPOINT : "");
  const nodeEnv = trim(env.NODE_ENV) || "development";
  const preprocessingProvider = normalizeProviderName(
    isHybridAlias ? OLLAMA_PROVIDER : env.TABLE_3D_AI_PREPROCESS_PROVIDER || env.TABLE_3D_AI_FIRST_PROVIDER,
  );
  const usesOllamaPreprocess = preprocessingProvider === OLLAMA_PROVIDER;
  const ollamaEndpoint = trim(env.TABLE_3D_AI_OLLAMA_ENDPOINT || env.OLLAMA_ENDPOINT) || DEFAULT_OLLAMA_ENDPOINT;
  const ollamaModel = trim(env.TABLE_3D_AI_OLLAMA_MODEL || env.OLLAMA_VISION_MODEL) || DEFAULT_OLLAMA_MODEL;
  const geminiModel = trim(env.TABLE_3D_AI_GEMINI_MODEL || env.GEMINI_MODEL) || DEFAULT_GEMINI_MODEL;
  const geminiEndpoint = trim(env.TABLE_3D_AI_GEMINI_ENDPOINT || env.GEMINI_ENDPOINT);
  const hi3dClientId = trim(env.TABLE_3D_AI_HI3D_CLIENT_ID || env.HI3D_CLIENT_ID);
  const hi3dClientSecret = trim(env.TABLE_3D_AI_HI3D_CLIENT_SECRET || env.HI3D_CLIENT_SECRET);
  const hi3dModel = trim(env.TABLE_3D_AI_HI3D_MODEL) || DEFAULT_HI3D_MODEL;
  const hi3dResolution = trim(env.TABLE_3D_AI_HI3D_RESOLUTION) || DEFAULT_HI3D_RESOLUTION;
  const hi3dFaceCount = normalizeIntegerInRange(
    env.TABLE_3D_AI_HI3D_FACE_COUNT,
    DEFAULT_HI3D_FACE_COUNT,
    100000,
    2000000,
  );
  const hi3dPbr = env.TABLE_3D_AI_HI3D_PBR == null
    ? true
    : normalizeBoolean(env.TABLE_3D_AI_HI3D_PBR);
  const isMock = provider === MOCK_PROVIDER && nodeEnv !== "production";
  const isGemini = provider === GEMINI_PROVIDER;
  const isMeshy = provider === MESHY_PROVIDER;
  const isHi3d = provider === HI3D_PROVIDER;
  const configured = enabled && (
    isMock ||
    (isGemini ? Boolean(apiKey) : isHi3d ? Boolean(hi3dClientId && hi3dClientSecret) : Boolean(provider && apiKey && endpoint))
  );

  return {
    provider,
    rawProvider,
    pipelineProvider: isHybridAlias ? rawProvider : provider,
    enabled,
    apiKey,
    endpoint,
    nodeEnv,
    isMock,
    isGemini,
    isMeshy,
    isHi3d,
    configured,
    preprocessingProvider,
    usesOllamaPreprocess,
    ollamaEndpoint,
    ollamaModel,
    geminiModel,
    geminiEndpoint,
    hi3dClientId,
    hi3dClientSecret,
    hi3dModel,
    hi3dResolution,
    hi3dFaceCount,
    hi3dPbr,
  };
};

export const getTable3DAiGenerationAvailability = (env = process.env) => {
  const config = getTable3DAiProviderConfig(env);
  if (!config.configured) {
    return {
      configured: false,
      status: "not_configured",
      message: CONFIG_REQUIRED_MESSAGE,
      provider: config.provider,
      pipelineProvider: config.pipelineProvider,
      preprocessingProvider: config.preprocessingProvider,
      isMock: config.isMock,
    };
  }

  if (config.isMock) {
    return {
      configured: true,
      status: "demo_only",
      message: "Demo-only mock provider is enabled. No real AI model will be generated.",
      provider: MOCK_PROVIDER,
      pipelineProvider: MOCK_PROVIDER,
      isMock: true,
    };
  }

  if (config.isMeshy) {
    return {
      configured: true,
      status: "ready",
      message: "Meshy AI 3D generation provider is configured.",
      provider: MESHY_PROVIDER,
      pipelineProvider: MESHY_PROVIDER,
      preprocessingProvider: config.preprocessingProvider,
      isMock: false,
    };
  }

  if (config.isHi3d) {
    return {
      configured: true,
      status: "ready",
      message: "Hi3D image-to-3D generation provider is configured.",
      provider: HI3D_PROVIDER,
      pipelineProvider: HI3D_PROVIDER,
      preprocessingProvider: config.preprocessingProvider,
      isMock: false,
    };
  }

  if (config.isGemini) {
    return {
      configured: true,
      status: "prompt_ready",
      message: PROMPT_READY_MESSAGE,
      provider: GEMINI_PROVIDER,
      pipelineProvider: config.usesOllamaPreprocess ? "ollama-gemini" : GEMINI_PROVIDER,
      preprocessingProvider: config.preprocessingProvider,
      isMock: false,
    };
  }

  return {
    configured: true,
    status: "pending_provider",
    message: PENDING_PROVIDER_MESSAGE,
    provider: config.provider,
    pipelineProvider: config.pipelineProvider,
    preprocessingProvider: config.preprocessingProvider,
    isMock: false,
  };
};

export const shouldKeepAiInputFilesForResult = (result = {}) => {
  if (!result?.ok) return false;
  if (["not_configured", "pending_provider", "demo_only", "prompt_ready"].includes(result.status)) return false;
  if (result.isMock || result.provider === MOCK_PROVIDER || result.aiProvider === MOCK_PROVIDER) return false;
  return ["queued", "processing"].includes(result.status);
};

export const normalizeTableModelGenerationInput = (input = {}, context = {}) => ({
  userId: trim(input.userId || context.userId || context.user?.id),
  restaurantId: trim(input.restaurantId || context.restaurantId),
  name: trim(input.name || input.label),
  tableType: trim(input.tableType || input.type),
  capacity: Math.max(1, Math.round(Number(input.capacity || 1))),
  defaultScale: Number(input.defaultScale || 1),
  dimensions: normalizeDimensions(input.dimensions || input.dimensionsCm || input),
  material: trim(input.material),
  color: trim(input.color),
  notes: trim(input.notes),
  tags: normalizeTags(input.tags),
  images: Array.isArray(input.images) ? input.images : [],
  licenseLabel: trim(input.licenseLabel || input.sourceLicense || input.licenseAcknowledgement),
});

const buildNotConfigured = () => ({
  ok: false,
  status: "not_configured",
  message: CONFIG_REQUIRED_MESSAGE,
});

const buildTableAnalysisPrompt = (normalized = {}) => `
You are preparing a restaurant table for a 3D model generation pipeline.
Analyze the uploaded reference images and the metadata below.
Return compact JSON only with these fields:
{
  "shape": "round|rectangular|square|booth|bar|outdoor|unknown",
  "capacity": number,
  "material": string,
  "color": string,
  "style": string,
  "dimensionsCm": { "width": number, "depth": number, "height": number, "diameter": number },
  "notableFeatures": string[],
  "generationPrompt": string
}

Metadata:
${JSON.stringify(omitImagePayloads(normalized), null, 2)}
`.trim();

const buildFinal3DPrompt = ({ normalized, preprocessing }) => {
  const tableSpec = preprocessing?.spec || {};
  return `
Create a usable low-poly 3D restaurant table model for a web-based model-viewer catalog.
The final asset should be exported as GLB by a real 3D generation engine/provider.

Base table metadata:
${JSON.stringify(omitImagePayloads(normalized), null, 2)}

Vision/preprocess analysis:
${JSON.stringify(tableSpec, null, 2)}

Requirements:
- Preserve the table type, approximate seat capacity, material, color, and proportions.
- Keep geometry practical for restaurant floor planning.
- Prefer clean low-poly mesh, centered origin, real-world scale, and web-friendly file size.
- Generate or return a GLB model URL only if the provider can create a real GLB asset.
`.trim();
};

const readImageBase64List = async (images = [], limit = 5) => {
  const results = [];
  for (const image of images.slice(0, limit)) {
    if (!image?.path) continue;
    try {
      const buffer = await fs.readFile(image.path);
      if (buffer.length) results.push(buffer.toString("base64"));
    } catch {
      // Skip missing local temp files; the caller will retain a warning.
    }
  }
  return results;
};

const buildUploadsRoot = (env = process.env) => path.resolve(env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
const getMaxModelBytes = (env = process.env) => Number.parseInt(env.TABLE_3D_MODEL_MAX_FILE_SIZE_BYTES || `${15 * 1024 * 1024}`, 10);
const asDataUri = async (image) => {
  const buffer = await fs.readFile(image.path);
  if (!buffer.length) throw new Error("AI reference image is empty");
  return `data:${trim(image.mimeType) || "application/octet-stream"};base64,${buffer.toString("base64")}`;
};

const downloadTableModel = async ({ url, env, provider = "AI" }) => {
  const response = await fetchWithTimeout(url, {}, 60000);
  if (!response.ok) throw new Error(`${provider} model download failed with HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const maxBytes = getMaxModelBytes(env);
  if (!buffer.length) throw new Error(`${provider} model download was empty`);
  if (buffer.length > maxBytes) throw new Error(`${provider} model exceeds max size of ${maxBytes} bytes`);
  const fileName = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.glb`;
  const dir = path.join(buildUploadsRoot(env), "table-3d", "models");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), buffer, { flag: "wx" });
  return `/uploads/table-3d/models/${fileName}`;
};

const requestMeshyGeneration = async ({ normalized, config }) => {
  if (normalized.images.length < 3 || normalized.images.length > 4) {
    throw new Error("Meshy table generation requires 3 to 4 reference images");
  }
  const imageUrls = await Promise.all(normalized.images.map(asDataUri));
  const response = await fetchWithTimeout(`${config.endpoint.replace(/\/$/, "")}/openapi/v1/multi-image-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_urls: imageUrls,
      ai_model: process.env.TABLE_3D_AI_MESHY_MODEL || "meshy-5",
      should_texture: true,
      enable_pbr: false,
      target_formats: ["glb"],
      target_polycount: 15000,
      image_enhancement: true,
      remove_lighting: true,
    }),
  }, 45000);
  if (!response.ok) throw new Error(`Meshy task creation failed with HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload?.result) throw new Error("Meshy task creation response did not include result");
  return String(payload.result);
};

const createMeshyJob = async ({ normalized, config }) => {
  const providerTaskId = await requestMeshyGeneration({ normalized, config });
  const jobId = `meshy-table3d-${crypto.randomUUID()}`;
  const job = {
    ok: true,
    jobId,
    providerTaskId,
    status: "queued",
    provider: MESHY_PROVIDER,
    aiProvider: MESHY_PROVIDER,
    generationStatus: "queued",
    input: omitImagePayloads(normalized),
    generatedModelUrl: "",
    generatedThumbnailUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobStore.set(jobId, job);
  return job;
};

const pollMeshyJob = async ({ job, config, env }) => {
  if (job.status === "completed" || job.status === "failed") return job;
  const response = await fetchWithTimeout(`${config.endpoint.replace(/\/$/, "")}/openapi/v1/multi-image-to-3d/${encodeURIComponent(job.providerTaskId)}`, {
    headers: { Authorization: `Bearer ${config.apiKey}` },
  }, 30000);
  if (!response.ok) throw new Error(`Meshy status check failed with HTTP ${response.status}`);
  const payload = await response.json();
  const providerStatus = trim(payload?.status).toUpperCase();
  if (["PENDING", "IN_PROGRESS"].includes(providerStatus)) {
    Object.assign(job, { status: "processing", generationStatus: "processing", progress: payload?.progress, updatedAt: new Date().toISOString() });
    return job;
  }
  if (providerStatus === "SUCCEEDED" && payload?.model_urls?.glb) {
    const generatedModelUrl = await downloadTableModel({ url: payload.model_urls.glb, env, provider: "Meshy" });
    Object.assign(job, {
      status: "completed",
      generationStatus: "completed",
      generatedModelUrl,
      generatedThumbnailUrl: trim(payload?.thumbnail_url),
      progress: 100,
      updatedAt: new Date().toISOString(),
    });
    return job;
  }
  if (providerStatus === "FAILED") {
    Object.assign(job, { status: "failed", generationStatus: "failed", message: trim(payload?.task_error?.message || payload?.message || payload?.error) || "Meshy generation failed", updatedAt: new Date().toISOString() });
    return job;
  }
  Object.assign(job, { status: "processing", generationStatus: "processing", updatedAt: new Date().toISOString() });
  return job;
};

const getHi3dPayloadError = (payload, fallback) => trim(payload?.msg || payload?.message) || fallback;
const isHi3dSuccessPayload = (payload) => Number(payload?.code) === 200;

const requestHi3dAccessToken = async (config) => {
  const credentials = Buffer.from(`${config.hi3dClientId}:${config.hi3dClientSecret}`, "utf8").toString("base64");
  const response = await fetchWithTimeout(`${config.endpoint.replace(/\/$/, "")}/open-api/v1/auth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  }, 30000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !isHi3dSuccessPayload(payload) || !payload?.data?.accessToken) {
    throw new Error(getHi3dPayloadError(payload, `Hi3D token request failed with HTTP ${response.status}`));
  }
  return String(payload.data.accessToken);
};

const buildHi3dTaskForm = async ({ normalized, config }) => {
  if (normalized.images.length < 3 || normalized.images.length > 5) {
    throw new Error("Hi3D table generation requires 3 to 5 reference images");
  }

  const form = new FormData();
  for (const [index, image] of normalized.images.entries()) {
    const buffer = await fs.readFile(image.path);
    if (!buffer.length) throw new Error("AI reference image is empty");
    form.append(
      "multi_images",
      new Blob([buffer], { type: trim(image.mimeType) || "application/octet-stream" }),
      trim(image.originalFileName || image.fileName) || `reference-${index + 1}.png`,
    );
  }
  form.append("request_type", "3");
  form.append("model", config.hi3dModel);
  form.append("resolution", config.hi3dResolution);
  form.append("face", String(config.hi3dFaceCount));
  form.append("format", "2");
  form.append("pbr", config.hi3dPbr ? "1" : "0");
  return form;
};

const requestHi3dGeneration = async ({ normalized, config }) => {
  const accessToken = await requestHi3dAccessToken(config);
  const body = await buildHi3dTaskForm({ normalized, config });
  const response = await fetchWithTimeout(`${config.endpoint.replace(/\/$/, "")}/open-api/v1/submit-task`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  }, 60000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !isHi3dSuccessPayload(payload) || !payload?.data?.task_id) {
    throw new Error(getHi3dPayloadError(payload, `Hi3D task creation failed with HTTP ${response.status}`));
  }
  return String(payload.data.task_id);
};

const createHi3dJob = async ({ normalized, config }) => {
  const providerTaskId = await requestHi3dGeneration({ normalized, config });
  const jobId = `hi3d-table3d-${crypto.randomUUID()}`;
  const job = {
    ok: true,
    jobId,
    providerTaskId,
    status: "queued",
    provider: HI3D_PROVIDER,
    aiProvider: HI3D_PROVIDER,
    generationStatus: "queued",
    input: omitImagePayloads(normalized),
    generatedModelUrl: "",
    generatedThumbnailUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobStore.set(jobId, job);
  return job;
};

const pollHi3dJob = async ({ job, config, env }) => {
  if (job.status === "completed" || job.status === "failed") return job;
  const accessToken = await requestHi3dAccessToken(config);
  const queryUrl = `${config.endpoint.replace(/\/$/, "")}/open-api/v1/query-task?task_id=${encodeURIComponent(job.providerTaskId)}`;
  const response = await fetchWithTimeout(queryUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  }, 30000);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !isHi3dSuccessPayload(payload)) {
    throw new Error(getHi3dPayloadError(payload, `Hi3D status check failed with HTTP ${response.status}`));
  }

  const providerStatus = normalizeProviderName(payload?.data?.state);
  if (["created", "queueing"].includes(providerStatus)) {
    Object.assign(job, {
      status: "queued",
      generationStatus: "queued",
      updatedAt: new Date().toISOString(),
    });
    return job;
  }
  if (providerStatus === "processing") {
    Object.assign(job, {
      status: "processing",
      generationStatus: "processing",
      updatedAt: new Date().toISOString(),
    });
    return job;
  }
  if (providerStatus === "success") {
    if (!payload?.data?.url) {
      Object.assign(job, {
        status: "failed",
        generationStatus: "failed",
        message: "Hi3D completed without a model URL",
        updatedAt: new Date().toISOString(),
      });
      return job;
    }
    const generatedModelUrl = await downloadTableModel({ url: payload.data.url, env, provider: "Hi3D" });
    Object.assign(job, {
      status: "completed",
      generationStatus: "completed",
      generatedModelUrl,
      generatedThumbnailUrl: trim(payload?.data?.cover_url),
      progress: 100,
      updatedAt: new Date().toISOString(),
    });
    return job;
  }
  if (providerStatus === "failed") {
    Object.assign(job, {
      status: "failed",
      generationStatus: "failed",
      message: getHi3dPayloadError(payload, "Hi3D generation failed"),
      updatedAt: new Date().toISOString(),
    });
    return job;
  }

  Object.assign(job, {
    status: "processing",
    generationStatus: "processing",
    updatedAt: new Date().toISOString(),
  });
  return job;
};

const requestOllamaPreprocess = async ({ normalized, config }) => {
  const images = await readImageBase64List(normalized.images);
  const response = await fetchWithTimeout(`${config.ollamaEndpoint.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      prompt: buildTableAnalysisPrompt(normalized),
      images,
      stream: false,
      format: "json",
    }),
  }, 45000);

  if (!response.ok) {
    throw new Error(`Ollama preprocess failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const rawText = trim(payload?.response || payload?.message?.content || "");
  const spec = safeJsonParse(rawText, { generationPrompt: rawText });
  return {
    ok: true,
    provider: OLLAMA_PROVIDER,
    model: config.ollamaModel,
    spec,
    rawText,
  };
};

const runOllamaPreprocessIfEnabled = async ({ normalized, config, context }) => {
  if (!config.usesOllamaPreprocess) return null;

  try {
    if (typeof context.preprocessWithOllama === "function") {
      return await context.preprocessWithOllama({ normalized, config, context });
    }
    return await requestOllamaPreprocess({ normalized, config });
  } catch (err) {
    return {
      ok: false,
      provider: OLLAMA_PROVIDER,
      model: config.ollamaModel,
      error: err?.message || "Ollama preprocess failed",
      warnings: ["ollama_preprocess_failed"],
    };
  }
};

const buildGeminiEndpoint = (config) => {
  if (config.geminiEndpoint) return config.geminiEndpoint;
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
};

const requestGeminiPromptRefinement = async ({ normalized, preprocessing, config }) => {
  const prompt = buildFinal3DPrompt({ normalized, preprocessing });
  const response = await fetchWithTimeout(buildGeminiEndpoint(config), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${prompt}\n\nReturn JSON only with fields: finalPrompt, suggestedDimensionsCm, modelingNotes, risks. Do not invent a generatedModelUrl.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    }),
  }, 45000);

  if (!response.ok) {
    throw new Error(`Gemini prompt refinement failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const rawText = trim(payload?.candidates?.[0]?.content?.parts?.[0]?.text || "");
  const spec = safeJsonParse(rawText, { finalPrompt: rawText || prompt });
  return {
    ok: true,
    provider: GEMINI_PROVIDER,
    model: config.geminiModel,
    prompt: spec?.finalPrompt || rawText || prompt,
    spec,
    rawText,
  };
};

const runGeminiFinalPromptIfEnabled = async ({ normalized, preprocessing, config, context }) => {
  if (!config.isGemini) return null;

  try {
    if (typeof context.finalizeWithGemini === "function") {
      return await context.finalizeWithGemini({ normalized, preprocessing, config, context });
    }
    return await requestGeminiPromptRefinement({ normalized, preprocessing, config });
  } catch (err) {
    return {
      ok: false,
      provider: GEMINI_PROVIDER,
      model: config.geminiModel,
      prompt: buildFinal3DPrompt({ normalized, preprocessing }),
      error: err?.message || "Gemini prompt refinement failed",
      warnings: ["gemini_prompt_refinement_failed"],
    };
  }
};

const createPromptReadyJob = ({ normalized, config, preprocessing, finalization }) => {
  const jobId = `prompt-table3d-${crypto.randomUUID()}`;
  const warnings = [
    "no_generated_model_url",
    "prompt_ready_only",
    ...(preprocessing?.warnings || []),
    ...(preprocessing?.ok === false ? ["ollama_preprocess_unavailable"] : []),
    ...(finalization?.warnings || []),
    ...(finalization?.ok === false ? ["gemini_final_prompt_unavailable"] : []),
  ];
  const finalPrompt = finalization?.prompt || buildFinal3DPrompt({ normalized, preprocessing });
  const job = {
    ok: true,
    jobId,
    status: "prompt_ready",
    provider: GEMINI_PROVIDER,
    aiProvider: config.usesOllamaPreprocess ? "ollama-gemini" : GEMINI_PROVIDER,
    preprocessingProvider: config.preprocessingProvider,
    generationStatus: "prompt_ready",
    message: PROMPT_READY_MESSAGE,
    warnings,
    input: omitImagePayloads(normalized),
    preprocessing: preprocessing || null,
    finalization: finalization || null,
    finalPrompt,
    generatedModelUrl: "",
    generatedThumbnailUrl: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobStore.set(jobId, job);
  return job;
};

export const requestTableModelGeneration = async (input = {}, context = {}) => {
  const config = getTable3DAiProviderConfig(context.env || process.env);
  if (!config.configured) return buildNotConfigured();

  const normalized = normalizeTableModelGenerationInput(input, context);

  if (config.isMock) {
    const jobId = `mock-table3d-${crypto.randomUUID()}`;
    const job = {
      ok: true,
      jobId,
      status: "queued",
      provider: MOCK_PROVIDER,
      aiProvider: MOCK_PROVIDER,
      generationStatus: "queued",
      message: "Demo-only mock job queued. No real AI model will be generated.",
      warnings: ["mock_demo_only", "no_generated_model_url", "input_images_not_retained"],
      input: omitImagePayloads(normalized),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    jobStore.set(jobId, job);
    return {
      ok: true,
      status: "queued",
      jobId,
      provider: MOCK_PROVIDER,
      message: job.message,
      warnings: job.warnings,
    };
  }

  if (config.isMeshy) {
    const job = await createMeshyJob({ normalized, config });
    return {
      ok: true,
      status: "queued",
      jobId: job.jobId,
      providerTaskId: job.providerTaskId,
      provider: MESHY_PROVIDER,
      aiProvider: MESHY_PROVIDER,
      generatedModelUrl: "",
      generatedThumbnailUrl: "",
      message: "Meshy generation task queued.",
    };
  }

  if (config.isHi3d) {
    const job = await createHi3dJob({ normalized, config });
    return {
      ok: true,
      status: "queued",
      jobId: job.jobId,
      providerTaskId: job.providerTaskId,
      provider: HI3D_PROVIDER,
      aiProvider: HI3D_PROVIDER,
      generatedModelUrl: "",
      generatedThumbnailUrl: "",
      message: "Hi3D generation task queued.",
    };
  }

  const preprocessing = await runOllamaPreprocessIfEnabled({ normalized, config, context });

  if (config.isGemini) {
    const finalization = await runGeminiFinalPromptIfEnabled({ normalized, preprocessing, config, context });
    const job = createPromptReadyJob({ normalized, config, preprocessing, finalization });
    return {
      ok: true,
      status: "prompt_ready",
      jobId: job.jobId,
      provider: GEMINI_PROVIDER,
      aiProvider: job.aiProvider,
      preprocessingProvider: job.preprocessingProvider,
      message: job.message,
      warnings: job.warnings,
      generatedModelUrl: "",
      generatedThumbnailUrl: "",
      finalPrompt: job.finalPrompt,
      preprocessing: job.preprocessing,
      finalization: job.finalization,
    };
  }

  return {
    ok: false,
    status: "pending_provider",
    provider: config.provider,
    preprocessing,
    message: PENDING_PROVIDER_MESSAGE,
  };
};

export const getTableModelGenerationStatus = async (jobId, context = {}) => {
  const config = getTable3DAiProviderConfig(context.env || process.env);
  if (!config.configured) {
    return { ...buildNotConfigured(), ok: true, jobId: trim(jobId), warnings: [] };
  }

  const normalizedJobId = trim(jobId);
  if (config.isMock) {
    const job = jobStore.get(normalizedJobId);
    if (!job) {
      return {
        ok: false,
        jobId: normalizedJobId,
        status: "failed",
        provider: MOCK_PROVIDER,
        warnings: ["mock_job_not_found"],
        message: "Mock AI 3D generation job was not found.",
      };
    }
    return {
      ok: true,
      jobId: normalizedJobId,
      status: "demo_only",
      provider: MOCK_PROVIDER,
      aiProvider: MOCK_PROVIDER,
      generatedModelUrl: "",
      generatedThumbnailUrl: "",
      warnings: job.warnings,
      message: "Demo-only mock status. Configure a real provider before generating a usable 3D model.",
      createdAt: job.createdAt,
      updatedAt: new Date().toISOString(),
    };
  }

  const job = jobStore.get(normalizedJobId);
  if (config.isMeshy) {
    if (!job || job.provider !== MESHY_PROVIDER) {
      return { ok: false, jobId: normalizedJobId, status: "failed", provider: MESHY_PROVIDER, message: "Meshy AI 3D generation job was not found." };
    }
    const updated = await pollMeshyJob({ job, config, env: context.env || process.env });
    return { ...updated, ok: true };
  }

  if (config.isHi3d) {
    if (!job || job.provider !== HI3D_PROVIDER) {
      return { ok: false, jobId: normalizedJobId, status: "failed", provider: HI3D_PROVIDER, message: "Hi3D AI 3D generation job was not found." };
    }
    const updated = await pollHi3dJob({ job, config, env: context.env || process.env });
    return { ...updated, ok: true };
  }

  if (job?.status === "prompt_ready") {
    return {
      ...job,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    ok: false,
    jobId: normalizedJobId,
    status: "pending_provider",
    provider: config.provider,
    warnings: ["provider_adapter_pending"],
    message: PENDING_PROVIDER_MESSAGE,
  };
};

export const clearTable3DAiGenerationJobsForTests = () => jobStore.clear();
