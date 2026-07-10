const DEFAULT_HOSTED_AI_TIMEOUT_MS = 8000;
const DEFAULT_LOCAL_CHAT_TIMEOUT_MS = 4000;
const DEFAULT_LOCAL_EMBEDDING_TIMEOUT_MS = 2500;
const GEMINI_HOST = "generativelanguage.googleapis.com";
const WRAPPED_FETCH_FLAG = "__cohanHostedAiTimeoutWrapped";

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
};

const requestUrl = (input) => {
  if (typeof input === "string") return input;
  if (typeof URL !== "undefined" && input instanceof URL) return input.toString();
  return String(input?.url || "");
};

const isGeminiRequest = (input) => {
  try {
    return new URL(requestUrl(input)).hostname === GEMINI_HOST;
  } catch {
    return false;
  }
};

export const getAiRuntimeTimeouts = (env = process.env) => ({
  hostedMs: toPositiveInt(
    env.AI_CHATBOT_GEMINI_TIMEOUT_MS || env.AI_PROVIDER_TIMEOUT_MS,
    DEFAULT_HOSTED_AI_TIMEOUT_MS,
  ),
  localChatMs: toPositiveInt(
    env.AI_CHATBOT_LOCAL_TIMEOUT_MS || env.LOCAL_AI_TIMEOUT_MS,
    DEFAULT_LOCAL_CHAT_TIMEOUT_MS,
  ),
  localEmbeddingMs: toPositiveInt(
    env.AI_CHATBOT_EMBEDDING_TIMEOUT_MS || env.LOCAL_AI_TIMEOUT_MS,
    DEFAULT_LOCAL_EMBEDDING_TIMEOUT_MS,
  ),
});

export const createHostedAiFetch = ({ fetchImpl = globalThis.fetch, env = process.env } = {}) => {
  if (typeof fetchImpl !== "function") throw new Error("fetch is not available");

  const wrappedFetch = async (input, init = {}) => {
    const existingSignal = init?.signal || input?.signal;
    if (!isGeminiRequest(input) || existingSignal) return fetchImpl(input, init);

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      getAiRuntimeTimeouts(env).hostedMs,
    );
    try {
      return await fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  Object.defineProperty(wrappedFetch, WRAPPED_FETCH_FLAG, { value: true });
  return wrappedFetch;
};

export const installHostedAiFetchTimeout = ({ env = process.env } = {}) => {
  const currentFetch = globalThis.fetch;
  if (typeof currentFetch !== "function" || currentFetch[WRAPPED_FETCH_FLAG]) return false;
  globalThis.fetch = createHostedAiFetch({ fetchImpl: currentFetch.bind(globalThis), env });
  return true;
};

export const __testables = {
  isGeminiRequest,
  requestUrl,
  toPositiveInt,
};
