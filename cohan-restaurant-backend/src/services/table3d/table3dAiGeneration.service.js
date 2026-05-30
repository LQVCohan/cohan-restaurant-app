import crypto from "node:crypto";

const CONFIG_REQUIRED_MESSAGE = "AI 3D generation provider is not configured";
const PENDING_PROVIDER_MESSAGE = "AI 3D generation provider adapter is pending implementation";
const MOCK_PROVIDER = "mock";
const jobStore = new Map();

const normalizeBoolean = (value) => ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
const trim = (value) => String(value || "").trim();
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

export const getTable3DAiProviderConfig = (env = process.env) => {
  const provider = trim(env.TABLE_3D_AI_PROVIDER).toLowerCase();
  const enabled = normalizeBoolean(env.TABLE_3D_AI_ENABLED);
  const apiKey = trim(env.TABLE_3D_AI_API_KEY);
  const endpoint = trim(env.TABLE_3D_AI_ENDPOINT);
  const nodeEnv = trim(env.NODE_ENV) || "development";
  const isMock = provider === MOCK_PROVIDER && nodeEnv !== "production";
  const configured = enabled && (isMock || Boolean(provider && apiKey && endpoint));

  return { provider, enabled, apiKey, endpoint, nodeEnv, isMock, configured };
};

export const normalizeTableModelGenerationInput = (input = {}, context = {}) => ({
  userId: trim(input.userId || context.userId || context.user?.id),
  restaurantId: trim(input.restaurantId || context.restaurantId),
  name: trim(input.name),
  tableType: trim(input.tableType),
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
      warnings: ["mock_demo_only", "no_generated_model_url"],
      input: normalized,
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

  return {
    ok: false,
    status: "pending_provider",
    provider: config.provider,
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
