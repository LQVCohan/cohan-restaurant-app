import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { AiChatbotKnowledgeItem } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission } from "../auth/authorization.service.js";
import { getAiChatbotCache, setAiChatbotCache } from "./restaurantChatbotCache.service.js";
import { createLocalEmbedding, getLocalAiConfig, isLocalAiEnabled } from "./localAiProvider.service.js";

const EMBEDDING_CACHE_PREFIX = "ai:embedding:query:";
const DEFAULT_EMBEDDING_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EMBEDDING_TEXT_CHARS = 4000;

const toObjectId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const normalizeEmbeddingProvider = () => String(process.env.AI_EMBEDDING_PROVIDER || "").trim().toLowerCase();
const embeddingCacheTtlMs = () => {
  const parsed = Number(process.env.AI_EMBEDDING_CACHE_TTL_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EMBEDDING_CACHE_TTL_MS;
};
const normalizeText = (text) => String(text || "").trim().replace(/\s+/g, " ").slice(0, MAX_EMBEDDING_TEXT_CHARS);
const hashText = (text) => createHash("sha256").update(normalizeText(text)).digest("hex");

export function embeddingTextForKnowledgeItem(item = {}) {
  const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean).join(", ") : "";
  return normalizeText([
    item.title ? `Title: ${item.title}` : "",
    item.category ? `Category: ${item.category}` : "",
    tags ? `Tags: ${tags}` : "",
    item.sourceType ? `Source: ${item.sourceType}` : "",
    item.content ? `Content: ${item.content}` : "",
  ].filter(Boolean).join("\n"));
}

export function hashEmbeddingContent(item = {}) {
  return hashText(embeddingTextForKnowledgeItem(item));
}

export async function createEmbedding(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  if (normalizeEmbeddingProvider() !== "local") return null;
  if (!isLocalAiEnabled()) return null;
  const config = getLocalAiConfig();
  const cacheKey = `${EMBEDDING_CACHE_PREFIX}${config.embeddingModel}:${hashText(normalized)}`;
  const cached = getAiChatbotCache(cacheKey);
  if (cached !== undefined) return cached;
  try {
    const result = await createLocalEmbedding(normalized);
    if (!Array.isArray(result?.embedding) || !result.embedding.length) return null;
    const value = { embedding: result.embedding, model: result.model || config.embeddingModel, provider: "local" };
    setAiChatbotCache(cacheKey, value, embeddingCacheTtlMs());
    return value;
  } catch {
    return null;
  }
}

export async function createEmbeddingForKnowledgeItem(item) {
  return createEmbedding(embeddingTextForKnowledgeItem(item));
}

export function shouldRefreshEmbedding(item = {}) {
  if (!item || item.enabled === false) return false;
  if (normalizeEmbeddingProvider() !== "local" || !isLocalAiEnabled()) return false;
  const model = getLocalAiConfig().embeddingModel;
  if (!Array.isArray(item.embedding) || !item.embedding.length) return true;
  if (String(item.embeddingModel || "") !== model) return true;
  return String(item.embeddingContentHash || "") !== hashEmbeddingContent(item);
}

export async function rebuildKnowledgeItemEmbedding(item) {
  if (!item) return { updated: false, skipped: true, error: null, item };
  if (!shouldRefreshEmbedding(item)) return { updated: false, skipped: true, error: null, item };
  try {
    const result = await createEmbeddingForKnowledgeItem(item);
    if (!Array.isArray(result?.embedding) || !result.embedding.length) {
      return { updated: false, skipped: false, error: "embedding_unavailable", item };
    }
    item.embedding = result.embedding;
    item.embeddingModel = result.model || getLocalAiConfig().embeddingModel;
    item.embeddingUpdatedAt = new Date();
    item.embeddingContentHash = hashEmbeddingContent(item);
    if (typeof item.save === "function") await item.save();
    return { updated: true, skipped: false, error: null, item };
  } catch (error) {
    console.warn("[ai-chatbot] knowledge embedding refresh failed", { code: error?.code || "EMBEDDING_ERROR" });
    return { updated: false, skipped: false, error: error?.code || "embedding_error", item };
  }
}

export async function rebuildRestaurantKnowledgeEmbeddings({ restaurantId, ctx, includeDisabled = false } = {}) {
  if (!ctx?.user?.id && !ctx?.user?._id) throw Object.assign(new Error("Cần đăng nhập"), { code: "UNAUTHENTICATED" });
  if (!mongoose.isValidObjectId(restaurantId)) throw Object.assign(new Error("restaurantId không hợp lệ"), { code: "BAD_USER_INPUT" });
  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  const query = { restaurantId: toObjectId(restaurantId) };
  if (!includeDisabled) query.enabled = true;
  const rows = await AiChatbotKnowledgeItem.find(query).sort({ priority: -1, updatedAt: -1 });
  const result = { total: rows.length, updated: 0, skipped: 0, failed: 0, errors: [] };
  for (const item of rows) {
    const out = await rebuildKnowledgeItemEmbedding(item);
    if (out.updated) result.updated += 1;
    else if (out.skipped) result.skipped += 1;
    else {
      result.failed += 1;
      if (out.error) result.errors.push(String(out.error));
    }
  }
  return result;
}

export const rebuildRestaurantAiKnowledgeEmbeddings = rebuildRestaurantKnowledgeEmbeddings;

export const __testables = { embeddingTextForKnowledgeItem, normalizeText, hashText };
