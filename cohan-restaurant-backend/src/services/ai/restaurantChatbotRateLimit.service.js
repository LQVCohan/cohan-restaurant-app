const DEFAULT_SAFE_MESSAGE = "Bạn đang gửi quá nhanh. Vui lòng thử lại sau ít phút.";

export const AI_CHATBOT_RATE_LIMIT_CODE = "RATE_LIMITED";
export const AI_CHATBOT_RATE_LIMIT_MESSAGE = DEFAULT_SAFE_MESSAGE;

export const AI_CHATBOT_RATE_LIMIT_POLICIES = {
  askAiChatbot: { action: "askAiChatbot", max: 20, windowMs: 5 * 60 * 1000 },
  requestAiChatbotHandoff: { action: "requestAiChatbotHandoff", max: 3, windowMs: 10 * 60 * 1000 },
  sendAiChatbotGuestMessage: { action: "sendAiChatbotGuestMessage", max: 30, windowMs: 10 * 60 * 1000 },
  aiChatbotGuestReplies: { action: "aiChatbotGuestReplies", max: 10, windowMs: 60 * 1000 },
  joinAiChatbotConversation: { action: "joinAiChatbotConversation", max: 5, windowMs: 30 * 1000 },
};

const buckets = new Map();
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanupAt = 0;

const normalizePart = (value, max = 128) => {
  const raw = String(value || "").trim().slice(0, max);
  if (!raw) return "na";
  return raw.replace(/[^a-zA-Z0-9_\-:.]/g, "_") || "na";
};

const normalizeIp = (value) => normalizePart(String(value || "").split(",")[0], 64);

const maybeCleanup = (now = Date.now()) => {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, entry] of buckets.entries()) {
    if (!entry?.windowEnd || entry.windowEnd <= now) buckets.delete(key);
  }
};

export const __resetAiChatbotRateLimitStoreForTests = () => {
  buckets.clear();
  lastCleanupAt = 0;
};

export const __getAiChatbotRateLimitBucketCountForTests = () => buckets.size;

export const buildAiChatbotRateLimitKey = ({ action, guestId, conversationId, restaurantId, clientIp, socketId } = {}) => {
  return [
    `action:${normalizePart(action, 48)}`,
    `guest:${normalizePart(guestId)}`,
    `conv:${normalizePart(conversationId)}`,
    `rest:${normalizePart(restaurantId)}`,
    `ip:${normalizeIp(clientIp)}`,
    `socket:${normalizePart(socketId, 128)}`,
  ].join("|");
};

export const consumeAiChatbotRateLimit = ({ policy, keyParts, nowMs = Date.now() } = {}) => {
  if (!policy?.action || !Number.isFinite(policy?.max) || !Number.isFinite(policy?.windowMs)) {
    return { allowed: true };
  }

  maybeCleanup(nowMs);
  const key = buildAiChatbotRateLimitKey({ action: policy.action, ...(keyParts || {}) });
  const windowMs = Math.max(1000, Number(policy.windowMs));
  const max = Math.max(1, Number(policy.max));

  let entry = buckets.get(key);
  if (!entry || entry.windowEnd <= nowMs) {
    entry = { count: 0, windowStart: nowMs, windowEnd: nowMs + windowMs };
  }

  if (entry.count >= max) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.windowEnd - nowMs) / 1000));
    buckets.set(key, entry);
    return {
      allowed: false,
      retryAfterSec,
      code: AI_CHATBOT_RATE_LIMIT_CODE,
      safeMessage: AI_CHATBOT_RATE_LIMIT_MESSAGE,
    };
  }

  entry.count += 1;
  buckets.set(key, entry);
  return { allowed: true };
};
