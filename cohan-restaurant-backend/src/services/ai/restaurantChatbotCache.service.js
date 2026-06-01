// Generic in-memory TTL cache for Phase 26 AI chatbot restaurant-level data only.
// Callers must never store API keys, tokens, passwords, secrets, user profiles, carts,
// orders, reservations, guest/user identifiers, or conversation history in this cache.
const aiChatbotCache = new Map();

const nowMs = () => Date.now();
const toExpiresAt = (ttlMs) => nowMs() + Math.max(0, Number(ttlMs) || 0);
const isExpired = (entry) => !entry || entry.expiresAt <= nowMs();

const assertStableKey = (key) => {
  if (typeof key !== "string" || !key.trim()) {
    throw new TypeError("AI chatbot cache key must be a non-empty string");
  }
  return key;
};

export function getAiChatbotCache(key) {
  const stableKey = assertStableKey(key);
  const entry = aiChatbotCache.get(stableKey);
  if (!entry) return undefined;
  if (isExpired(entry)) {
    aiChatbotCache.delete(stableKey);
    return undefined;
  }
  return entry.value;
}

export function setAiChatbotCache(key, value, ttlMs) {
  const stableKey = assertStableKey(key);
  aiChatbotCache.set(stableKey, { value, expiresAt: toExpiresAt(ttlMs), createdAt: nowMs() });
  return value;
}

export async function getOrSetAiChatbotCache(key, loader, ttlMs) {
  const cached = getAiChatbotCache(key);
  if (cached !== undefined) return cached;
  const loaded = await loader();
  setAiChatbotCache(key, loaded, ttlMs);
  return loaded;
}

export function deleteAiChatbotCache(key) {
  return aiChatbotCache.delete(assertStableKey(key));
}

export function deleteAiChatbotCacheByPrefix(prefix) {
  const stablePrefix = assertStableKey(prefix);
  let deleted = 0;
  for (const key of aiChatbotCache.keys()) {
    if (key.startsWith(stablePrefix)) {
      aiChatbotCache.delete(key);
      deleted += 1;
    }
  }
  return deleted;
}

export function clearAiChatbotCache() {
  aiChatbotCache.clear();
}

export function getAiChatbotCacheStats() {
  let expiredEntries = 0;
  for (const entry of aiChatbotCache.values()) {
    if (isExpired(entry)) expiredEntries += 1;
  }
  return {
    entries: aiChatbotCache.size,
    activeEntries: aiChatbotCache.size - expiredEntries,
    expiredEntries,
  };
}
