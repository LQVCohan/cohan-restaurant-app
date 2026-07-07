const DEFAULT_BASE_URL = "http://localhost:11434";
const DEFAULT_CHAT_PATH = "/api/chat";
const DEFAULT_EMBEDDING_PATH = "/api/embeddings";
const DEFAULT_CHAT_MODEL = "qwen3:8b";
const DEFAULT_EMBEDDING_MODEL = "bge-m3";
const DEFAULT_TIMEOUT_MS = 30000;

const enabledValues = new Set(["1", "true", "yes", "on"]);
const supportedProviders = new Set(["ollama"]);

const cleanPath = (path, fallback) => {
  const value = String(path || fallback || "").trim();
  if (!value) return fallback;
  return value.startsWith("/") ? value : `/${value}`;
};

const cleanBaseUrl = (value) => String(value || DEFAULT_BASE_URL).trim().replace(/\/+$/g, "") || DEFAULT_BASE_URL;
const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

const joinUrl = (baseUrl, path) => `${cleanBaseUrl(baseUrl)}${cleanPath(path, "")}`;

const safeWarn = (message, meta = {}) => {
  const safeMeta = {
    provider: meta.provider,
    model: meta.model,
    path: meta.path,
    status: meta.status,
    code: meta.code,
  };
  console.warn(message, Object.fromEntries(Object.entries(safeMeta).filter(([, v]) => v != null && v !== "")));
};

export function getLocalAiConfig() {
  const provider = String(process.env.LOCAL_AI_PROVIDER || "ollama").trim().toLowerCase();
  return {
    enabled: enabledValues.has(String(process.env.LOCAL_AI_ENABLED || "false").trim().toLowerCase()),
    provider: supportedProviders.has(provider) ? provider : "ollama",
    baseUrl: cleanBaseUrl(process.env.LOCAL_AI_BASE_URL),
    chatPath: cleanPath(process.env.LOCAL_AI_CHAT_PATH, DEFAULT_CHAT_PATH),
    embeddingPath: cleanPath(process.env.LOCAL_AI_EMBEDDING_PATH, DEFAULT_EMBEDDING_PATH),
    chatModel: String(process.env.LOCAL_AI_CHAT_MODEL || DEFAULT_CHAT_MODEL).trim() || DEFAULT_CHAT_MODEL,
    embeddingModel: String(process.env.LOCAL_AI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL).trim() || DEFAULT_EMBEDDING_MODEL,
    timeoutMs: toPositiveInt(process.env.LOCAL_AI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

export function isLocalAiEnabled() {
  return getLocalAiConfig().enabled;
}

const fetchJsonWithTimeout = async (url, payload, { timeoutMs, provider, model, path }) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const err = Object.assign(new Error("Local AI provider returned an error"), {
        code: "LOCAL_AI_PROVIDER_ERROR",
        status: response.status,
        provider,
        model,
        path,
      });
      throw err;
    }
    return response.json();
  } catch (error) {
    const code = error?.name === "AbortError" ? "LOCAL_AI_TIMEOUT" : (error?.code || "LOCAL_AI_PROVIDER_ERROR");
    const err = Object.assign(new Error(code === "LOCAL_AI_TIMEOUT" ? "Local AI provider timed out" : "Local AI provider failed"), {
      code,
      status: error?.status,
      provider,
      model,
      path,
    });
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const normalizeChatMessages = ({ messages = [], systemInstruction }) => {
  const normalized = [];
  if (systemInstruction) normalized.push({ role: "system", content: String(systemInstruction) });
  for (const message of messages || []) {
    const role = ["system", "assistant", "user"].includes(message?.role) ? message.role : "user";
    const content = String(message?.content || "").trim();
    if (content) normalized.push({ role, content });
  }
  return normalized;
};

export async function callLocalChatProvider({ messages = [], systemInstruction = "", temperature = 0.25, maxTokens = 800 } = {}) {
  const config = getLocalAiConfig();
  if (!config.enabled) return null;
  const payload = {
    model: config.chatModel,
    messages: normalizeChatMessages({ messages, systemInstruction }),
    stream: false,
    options: {
      temperature: Number.isFinite(Number(temperature)) ? Number(temperature) : 0.25,
      num_predict: Number.isFinite(Number(maxTokens)) ? Number(maxTokens) : 800,
    },
  };
  try {
    const data = await fetchJsonWithTimeout(joinUrl(config.baseUrl, config.chatPath), payload, {
      timeoutMs: config.timeoutMs,
      provider: config.provider,
      model: config.chatModel,
      path: config.chatPath,
    });
    const content = data?.message?.content || data?.choices?.[0]?.message?.content || data?.response || data?.content || "";
    const text = String(content || "").trim();
    return text ? { content: text, raw: data, provider: "local", model: config.chatModel } : null;
  } catch (error) {
    safeWarn("[ai-chatbot] local chat provider unavailable", error);
    return null;
  }
}

const normalizeEmbedding = (data) => {
  const source = data?.embedding || data?.data?.[0]?.embedding || data?.embeddings?.[0] || data?.vector;
  if (!Array.isArray(source)) return null;
  const embedding = source.map(Number).filter((value) => Number.isFinite(value));
  return embedding.length ? embedding : null;
};

export async function createLocalEmbedding(text) {
  const config = getLocalAiConfig();
  if (!config.enabled) return null;
  const input = String(text || "").trim();
  if (!input) return null;
  const payload = {
    model: config.embeddingModel,
    prompt: input,
    input,
  };
  try {
    const data = await fetchJsonWithTimeout(joinUrl(config.baseUrl, config.embeddingPath), payload, {
      timeoutMs: config.timeoutMs,
      provider: config.provider,
      model: config.embeddingModel,
      path: config.embeddingPath,
    });
    const embedding = normalizeEmbedding(data);
    return embedding ? { embedding, provider: "local", model: config.embeddingModel } : null;
  } catch (error) {
    safeWarn("[ai-chatbot] local embedding provider unavailable", error);
    return null;
  }
}
