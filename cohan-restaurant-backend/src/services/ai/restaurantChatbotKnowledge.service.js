import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { AiChatbotKnowledgeItem } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  requireAnyRestaurantPermission,
  requireRestaurantPermission,
} from "../auth/authorization.service.js";
import {
  deleteAiChatbotCacheByPrefix,
  getOrSetAiChatbotCache,
} from "./restaurantChatbotCache.service.js";
import {
  createEmbedding,
  hashEmbeddingContent,
  rebuildKnowledgeItemEmbedding,
  rebuildRestaurantKnowledgeEmbeddings,
} from "./restaurantChatbotEmbedding.service.js";

const MAX_TAGS = 10;
const MAX_TITLE = 160;
const MAX_CONTENT = 3000;
const MAX_CATEGORY = 80;
const MAX_TAG = 40;
const PRIORITY_MIN = 0;
const PRIORITY_MAX = 100;
const SOURCE_TYPES = new Set(["manual", "faq", "policy", "suggestion"]);
const KNOWLEDGE_READ_PERMISSIONS = [
  PERMISSIONS.AI_CHATBOT_READ,
  PERMISSIONS.AI_CHATBOT_WRITE,
  PERMISSIONS.AI_CHATBOT_MODERATE,
  PERMISSIONS.AI_CHATBOT_EVALUATE,
];
const KNOWLEDGE_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEMANTIC_RETRIEVAL_CACHE_TTL_MS = 5 * 60 * 1000;
const KNOWLEDGE_SEARCH_CACHE_PREFIX = "ai:knowledge:relevant:";

const knowledgeCachePrefix = (restaurantId) =>
  `${KNOWLEDGE_SEARCH_CACHE_PREFIX}${restaurantId}:`;
const normalizeMessageForCache = (message) =>
  String(message || "")
    .trim()
    .toLowerCase()
    .slice(0, 500);
const hashNormalizedMessage = (message) =>
  createHash("sha256").update(message).digest("hex").slice(0, 16);
const knowledgeCacheKey = ({ restaurantId, limit, message }) =>
  `${knowledgeCachePrefix(restaurantId)}${limit}:${hashNormalizedMessage(normalizeMessageForCache(message))}`;
const invalidateRelevantKnowledgeCache = (restaurantId) => {
  if (restaurantId)
    deleteAiChatbotCacheByPrefix(knowledgeCachePrefix(String(restaurantId)));
};

const toObjectId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
const clean = (v, max) =>
  String(v || "")
    .trim()
    .slice(0, max);
const clampPriority = (v) =>
  Math.min(
    PRIORITY_MAX,
    Math.max(PRIORITY_MIN, Number.isFinite(Number(v)) ? Number(v) : 0),
  );
const normalizeTags = (tags) => {
  const src = Array.isArray(tags) ? tags : [];
  const out = [];
  for (const raw of src) {
    const t = clean(raw, MAX_TAG);
    if (!t) continue;
    if (!out.includes(t)) out.push(t);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
};

const ensureAuth = (ctx) => {
  if (!ctx?.user?.id && !ctx?.user?._id)
    throw Object.assign(new Error("Cần đăng nhập"), {
      code: "UNAUTHENTICATED",
    });
};
const ensureRestaurantPermission = async (
  ctx,
  restaurantId,
  permissionCode,
) => {
  ensureAuth(ctx);
  if (!mongoose.isValidObjectId(restaurantId))
    throw Object.assign(new Error("restaurantId không hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  await requireRestaurantPermission(ctx, restaurantId, permissionCode);
};
const ensureAnyAiRestaurantPermission = async (
  ctx,
  restaurantId,
  permissionCodes,
) => {
  ensureAuth(ctx);

  if (!mongoose.isValidObjectId(restaurantId)) {
    throw Object.assign(new Error("restaurantId không hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  }

  await requireAnyRestaurantPermission(ctx, restaurantId, permissionCodes);
};
const toKnowledgeDto = (item) => {
  if (!item) return null;
  const { embedding, ...safeItem } = item;
  return {
    ...safeItem,
    id: String(item._id || item.id || ""),
    restaurantId: item.restaurantId ? String(item.restaurantId) : "",
    tags: Array.isArray(item.tags) ? item.tags : [],
    enabled: item.enabled !== false,
    priority: Number(item.priority || 0),
    sourceType: item.sourceType || "manual",
  };
};

const sanitizeInput = (input = {}, { partial = false } = {}) => {
  const patch = {};
  if (!partial || input.title != null) {
    const title = clean(input.title, MAX_TITLE);
    if (!title && !partial)
      throw Object.assign(new Error("title là bắt buộc"), {
        code: "BAD_USER_INPUT",
      });
    if (title) patch.title = title;
  }
  if (!partial || input.content != null) {
    const content = clean(input.content, MAX_CONTENT);
    if (!content && !partial)
      throw Object.assign(new Error("content là bắt buộc"), {
        code: "BAD_USER_INPUT",
      });
    if (content) patch.content = content;
  }
  if (!partial || input.category != null)
    patch.category = clean(input.category, MAX_CATEGORY);
  if (!partial || input.tags != null) patch.tags = normalizeTags(input.tags);
  if (!partial || input.enabled != null) patch.enabled = Boolean(input.enabled);
  if (!partial || input.priority != null)
    patch.priority = clampPriority(input.priority);
  if (!partial || input.sourceType != null) {
    const sourceType = clean(input.sourceType || "manual", 20).toLowerCase();
    patch.sourceType = SOURCE_TYPES.has(sourceType) ? sourceType : "manual";
  }
  return patch;
};

export async function listRestaurantAiChatbotKnowledge({
  restaurantId,
  filter,
  ctx,
}) {
  await ensureAnyAiRestaurantPermission(
    ctx,
    restaurantId,
    KNOWLEDGE_READ_PERMISSIONS,
  );
  const rid = toObjectId(restaurantId);
  const q = { restaurantId: rid };
  if (filter?.enabled != null) q.enabled = Boolean(filter.enabled);
  if (filter?.category) q.category = clean(filter.category, MAX_CATEGORY);
  if (filter?.search) {
    const search = clean(filter.search, 80);
    if (search) q.$text = { $search: search };
  }
  const rows = await AiChatbotKnowledgeItem.find(q)
    .sort(
      filter?.search
        ? { score: { $meta: "textScore" }, priority: -1, updatedAt: -1 }
        : { priority: -1, updatedAt: -1 },
    )
    .lean();
  return rows.map(toKnowledgeDto);
}

export async function getRestaurantAiChatbotKnowledgeItem({ id, ctx }) {
  ensureAuth(ctx);
  if (!mongoose.isValidObjectId(id)) return null;
  const item = await AiChatbotKnowledgeItem.findById(id).lean();
  if (!item) return null;
  await ensureAnyAiRestaurantPermission(
    ctx,
    item.restaurantId,
    KNOWLEDGE_READ_PERMISSIONS,
  );
  return toKnowledgeDto(item);
}

const safelyRefreshKnowledgeEmbedding = async (doc) => {
  if (!doc || doc.enabled === false) return;
  try {
    await rebuildKnowledgeItemEmbedding(doc);
  } catch (error) {
    console.warn("[ai-chatbot] knowledge embedding generation skipped", {
      code: error?.code || "EMBEDDING_ERROR",
    });
  }
};

export async function createRestaurantAiChatbotKnowledgeItem({
  input,
  ctx,
  skipPermissionCheck = false,
}) {
  const restaurantId = input?.restaurantId;
  if (!skipPermissionCheck) {
    await ensureRestaurantPermission(
      ctx,
      restaurantId,
      PERMISSIONS.AI_CHATBOT_WRITE,
    );
  }
  const doc = await AiChatbotKnowledgeItem.create({
    restaurantId: toObjectId(restaurantId),
    ...sanitizeInput(input),
    createdBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
    updatedBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
  });
  await safelyRefreshKnowledgeEmbedding(doc);
  invalidateRelevantKnowledgeCache(restaurantId);
  return toKnowledgeDto(doc.toObject());
}

export async function updateRestaurantAiChatbotKnowledgeItem({ input, ctx }) {
  if (!mongoose.isValidObjectId(input?.id))
    throw Object.assign(new Error("id không hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  const found = await AiChatbotKnowledgeItem.findById(input.id);
  if (!found)
    throw Object.assign(new Error("Không tìm thấy dữ liệu"), {
      code: "NOT_FOUND",
    });
  await ensureRestaurantPermission(
    ctx,
    found.restaurantId,
    PERMISSIONS.AI_CHATBOT_WRITE,
  );
  Object.assign(found, sanitizeInput(input, { partial: true }), {
    updatedBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
  });
  if (found.enabled !== false) found.embeddingContentHash = "";
  await found.save();
  await safelyRefreshKnowledgeEmbedding(found);
  invalidateRelevantKnowledgeCache(found.restaurantId);
  return toKnowledgeDto(found.toObject());
}

export async function deleteRestaurantAiChatbotKnowledgeItem({ id, ctx }) {
  if (!mongoose.isValidObjectId(id)) return false;
  const found = await AiChatbotKnowledgeItem.findById(id).lean();
  if (!found) return false;
  await ensureRestaurantPermission(
    ctx,
    found.restaurantId,
    PERMISSIONS.AI_CHATBOT_WRITE,
  );
  await AiChatbotKnowledgeItem.deleteOne({ _id: found._id });
  invalidateRelevantKnowledgeCache(found.restaurantId);
  return true;
}

const tokenize = (message) =>
  String(message || "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 12);
const scoreByTokens = (item, tokens) => {
  const text =
    `${item.title || ""} ${item.content || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
  let score = Number(item.priority || 0) * 0.2;
  for (const tk of tokens) {
    if ((item.title || "").toLowerCase().includes(tk)) score += 5;
    if ((item.tags || []).some((t) => String(t).toLowerCase().includes(tk)))
      score += 3;
    if (text.includes(tk)) score += 1;
  }
  return score;
};

const cosineSimilarity = (a = [], b = []) => {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i += 1) {
    const av = Number(a[i]);
    const bv = Number(b[i]);
    if (!Number.isFinite(av) || !Number.isFinite(bv)) continue;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const priorityBoost = (item) =>
  Math.min(1, Math.max(0, Number(item?.priority || 0) / 100));
const normalizeTextScore = (score) =>
  Math.min(1, Math.max(0, Number(score || 0) / 10));

const mergeAndRankKnowledgeRows = ({
  semanticRows = [],
  textRows = [],
  tokens = [],
  safeLimit,
}) => {
  const byId = new Map();
  const upsert = (item, patch) => {
    const id = String(item?._id || item?.id || "");
    if (!id) return;
    const previous = byId.get(id) || { item, semanticScore: 0, textScore: 0 };
    byId.set(id, {
      ...previous,
      item: { ...previous.item, ...item },
      ...patch,
    });
  };
  for (const row of semanticRows)
    upsert(row.item, { semanticScore: Math.max(0, row.score) });
  for (const item of textRows)
    upsert(item, {
      textScore: Math.max(
        scoreByTokens(item, tokens),
        Number(item?._textScore || 0),
      ),
    });
  return [...byId.values()]
    .map((row) => {
      const combinedScore =
        row.semanticScore * 0.7 +
        normalizeTextScore(row.textScore) * 0.2 +
        priorityBoost(row.item) * 0.1;
      return {
        ...row.item,
        _score: combinedScore,
        _semanticScore: row.semanticScore || 0,
        _textScore: row.textScore || 0,
      };
    })
    .sort(
      (a, b) =>
        b._score - a._score ||
        Number(b.priority || 0) - Number(a.priority || 0) ||
        new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
    )
    .slice(0, safeLimit);
};

const loadTextKnowledgeRows = async ({ query, message, safeLimit }) => {
  const search = clean(message, 120);
  if (search) {
    const textRows = await AiChatbotKnowledgeItem.find({
      ...query,
      $text: { $search: search },
    })
      .sort({ score: { $meta: "textScore" }, priority: -1, updatedAt: -1 })
      .limit(safeLimit)
      .lean();
    if (textRows.length)
      return textRows.map((item) => ({
        ...item,
        _textScore: scoreByTokens(item, tokenize(message)) || 5,
      }));
  }
  const rows = await AiChatbotKnowledgeItem.find(query)
    .sort({ priority: -1, updatedAt: -1 })
    .limit(50)
    .lean();
  const tokens = tokenize(message);
  return rows
    .map((item) => ({ ...item, _textScore: scoreByTokens(item, tokens) }))
    .filter((row) => row._textScore > 0)
    .sort((a, b) => b._textScore - a._textScore)
    .slice(0, safeLimit);
};

const loadSemanticKnowledgeRows = async ({ query, message, safeLimit }) => {
  const queryEmbedding = await createEmbedding(message);
  if (
    !Array.isArray(queryEmbedding?.embedding) ||
    !queryEmbedding.embedding.length
  )
    return [];
  const rows = await AiChatbotKnowledgeItem.find({
    ...query,
    embedding: { $exists: true, $ne: [] },
  })
    .sort({ priority: -1, updatedAt: -1 })
    .limit(100)
    .lean();
  return rows
    .map((item) => ({
      item,
      score: cosineSimilarity(queryEmbedding.embedding, item.embedding || []),
    }))
    .filter((row) => row.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(safeLimit * 2, safeLimit));
};

const loadRelevantKnowledgeForChatbot = async ({ rid, message, safeLimit }) => {
  const query = { restaurantId: rid, enabled: true };
  const tokens = tokenize(message);
  const [semanticRows, textRows] = await Promise.all([
    getOrSetAiChatbotCache(
      `${knowledgeCacheKey({ restaurantId: String(rid), limit: safeLimit, message })}:semantic`,
      () => loadSemanticKnowledgeRows({ query, message, safeLimit }),
      SEMANTIC_RETRIEVAL_CACHE_TTL_MS,
    ),
    loadTextKnowledgeRows({ query, message, safeLimit }),
  ]);
  const merged = mergeAndRankKnowledgeRows({
    semanticRows,
    textRows,
    tokens,
    safeLimit,
  });
  return merged.length ? merged : textRows.slice(0, safeLimit);
};

export async function findRelevantKnowledgeForChatbot({
  restaurantId,
  message,
  limit = 4,
}) {
  const rid = toObjectId(restaurantId);
  if (!rid) return [];
  const safeLimit = Math.min(5, Math.max(1, Number(limit) || 4));
  const stableRestaurantId = String(rid);
  return getOrSetAiChatbotCache(
    knowledgeCacheKey({
      restaurantId: stableRestaurantId,
      limit: safeLimit,
      message,
    }),
    async () => loadRelevantKnowledgeForChatbot({ rid, message, safeLimit }),
    KNOWLEDGE_SEARCH_CACHE_TTL_MS,
  );
}

const parseCsvLine = (line = "") => {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else q = !q;
      continue;
    }
    if (ch === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((v) => String(v || "").trim());
};

const toImportTags = (raw) =>
  Array.isArray(raw)
    ? normalizeTags(raw)
    : normalizeTags(String(raw || "").split(/[|,]/g));

export async function bulkUpdateRestaurantAiChatbotKnowledgeEnabled({
  ids = [],
  enabled,
  ctx,
}) {
  const oid = ids
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!oid.length) return false;
  const rows = await AiChatbotKnowledgeItem.find({ _id: { $in: oid } }).lean();
  const byRestaurant = new Map();
  for (const row of rows) {
    const rid = String(row.restaurantId || "");
    if (!byRestaurant.has(rid)) byRestaurant.set(rid, []);
    byRestaurant.get(rid).push(row._id);
  }
  for (const rid of byRestaurant.keys())
    await ensureRestaurantPermission(ctx, rid, PERMISSIONS.AI_CHATBOT_WRITE);
  await AiChatbotKnowledgeItem.updateMany(
    { _id: { $in: oid } },
    {
      $set: {
        enabled: Boolean(enabled),
        updatedBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
      },
    },
  );
  for (const rid of byRestaurant.keys()) invalidateRelevantKnowledgeCache(rid);
  return true;
}

export async function bulkDeleteRestaurantAiChatbotKnowledge({
  ids = [],
  ctx,
}) {
  const oid = ids
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (!oid.length) return false;
  const rows = await AiChatbotKnowledgeItem.find({ _id: { $in: oid } }).lean();
  for (const rid of [...new Set(rows.map((r) => String(r.restaurantId || "")))])
    await ensureRestaurantPermission(ctx, rid, PERMISSIONS.AI_CHATBOT_WRITE);
  await AiChatbotKnowledgeItem.deleteMany({ _id: { $in: oid } });
  for (const rid of [...new Set(rows.map((r) => String(r.restaurantId || "")))])
    invalidateRelevantKnowledgeCache(rid);
  return true;
}

export async function exportRestaurantAiChatbotKnowledge({
  restaurantId,
  format = "json",
  ctx,
}) {
  await ensureAnyAiRestaurantPermission(
    ctx,
    restaurantId,
    KNOWLEDGE_READ_PERMISSIONS,
  );
  const rows = await AiChatbotKnowledgeItem.find({
    restaurantId: toObjectId(restaurantId),
  })
    .sort({ priority: -1, updatedAt: -1 })
    .lean();
  const items = rows.map((r) => ({
    title: r.title,
    content: r.content,
    category: r.category || "",
    tags: Array.isArray(r.tags) ? r.tags : [],
    enabled: r.enabled !== false,
    priority: Number(r.priority || 0),
    sourceType: r.sourceType || "manual",
  }));
  if (String(format).toLowerCase() === "csv") {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const header = [
      "title",
      "content",
      "category",
      "tags",
      "enabled",
      "priority",
      "sourceType",
    ].join(",");
    const lines = items.map((it) =>
      [
        esc(it.title),
        esc(it.content),
        esc(it.category),
        esc(it.tags.join("|")),
        esc(it.enabled),
        esc(it.priority),
        esc(it.sourceType),
      ].join(","),
    );
    return [header, ...lines].join("\n");
  }
  return JSON.stringify(items, null, 2);
}

export async function importRestaurantAiChatbotKnowledge({ input, ctx }) {
  await ensureRestaurantPermission(
    ctx,
    input?.restaurantId,
    PERMISSIONS.AI_CHATBOT_WRITE,
  );
  const format = clean(input?.format || "json", 10).toLowerCase();
  const payload = String(input?.payload || "");
  const errors = [];
  let imported = 0;
  let skipped = 0;
  let rows = [];
  try {
    if (format === "csv") {
      const lines = payload.split(/\r?\n/).filter(Boolean);
      const head = parseCsvLine(lines.shift() || "").map((h) =>
        h.toLowerCase(),
      );
      rows = lines.map((line) => {
        const cols = parseCsvLine(line);
        const obj = {};
        head.forEach((h, i) => {
          obj[h] = cols[i];
        });
        return obj;
      });
    } else {
      const parsed = JSON.parse(payload || "[]");
      rows = Array.isArray(parsed) ? parsed : [];
    }
  } catch {
    throw Object.assign(new Error("Import payload không hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  }
  const rid = toObjectId(input.restaurantId);
  for (const row of rows) {
    const title = clean(row?.title, MAX_TITLE);
    const content = clean(row?.content, MAX_CONTENT);
    if (!title || !content) {
      skipped += 1;
      errors.push("title/content required");
      continue;
    }
    const category = clean(row?.category, MAX_CATEGORY);
    const tags = toImportTags(row?.tags);
    const enabled =
      row?.enabled == null
        ? true
        : String(row.enabled).toLowerCase() !== "false";
    const priority = clampPriority(row?.priority);
    const sourceTypeRaw = clean(row?.sourceType || "", 20).toLowerCase();
    const sourceType = SOURCE_TYPES.has(sourceTypeRaw)
      ? sourceTypeRaw
      : "manual";
    const dup = await AiChatbotKnowledgeItem.findOne({
      restaurantId: rid,
      title,
      content,
    }).lean();
    if (dup) {
      skipped += 1;
      continue;
    }
    const doc = await AiChatbotKnowledgeItem.create({
      restaurantId: rid,
      title,
      content,
      category,
      tags,
      enabled,
      priority,
      sourceType,
      createdBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
      updatedBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
    });
    await safelyRefreshKnowledgeEmbedding(doc);
    imported += 1;
  }
  invalidateRelevantKnowledgeCache(input?.restaurantId);
  return { imported, skipped, errors };
}

export async function rebuildRestaurantAiKnowledgeEmbeddings({
  restaurantId,
  ctx,
}) {
  const result = await rebuildRestaurantKnowledgeEmbeddings({
    restaurantId,
    ctx,
  });
  invalidateRelevantKnowledgeCache(restaurantId);
  return result;
}

export const __testables = {
  tokenize,
  scoreByTokens,
  cosineSimilarity,
  mergeAndRankKnowledgeRows,
  hashEmbeddingContent,
};
