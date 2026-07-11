import mongoose from "mongoose";
import {
  AiChatbotKnowledgeItem,
  Restaurant,
} from "../../../models/index.js";
import { createEmbedding } from "./restaurantChatbotEmbedding.service.js";
import { __testables as chatbotCoreTestables } from "./restaurantChatbotCore.service.js";

const ELIGIBLE_RESTAURANT_FILTER = {
  businessStatus: "active",
  publicationStatus: "published",
  "aiChatbotSettings.enabled": { $ne: false },
};

const STOP_WORDS = new Set([
  "ai",
  "an",
  "ban",
  "co",
  "cho",
  "cua",
  "duoc",
  "gi",
  "khong",
  "minh",
  "mon",
  "muon",
  "nay",
  "ngon",
  "nha",
  "the",
  "thi",
  "toi",
]);

const normalizeText = (value = "") =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase();

const tokenize = (value = "") =>
  normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
    .slice(0, 12);

const toObjectId = (value) =>
  value && mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(value)
    : null;

const knowledgeTokenScore = (item = {}, tokens = []) => {
  const title = normalizeText(item.title);
  const content = normalizeText(item.content);
  const tags = (Array.isArray(item.tags) ? item.tags : []).map(normalizeText);
  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 4;
    if (tags.some((tag) => tag.includes(token))) score += 3;
    if (content.includes(token)) score += 1;
  }

  return score;
};

const cosineSimilarity = (left = [], right = []) => {
  const length = Math.min(left.length, right.length);
  if (!length) return 0;

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < length; index += 1) {
    const leftValue = Number(left[index]);
    const rightValue = Number(right[index]);
    if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) continue;
    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const pickUniqueOwner = (scoredRows = [], { minimum = 2, ratio = 0.6 } = {}) => {
  const ranked = scoredRows
    .filter((row) => row?.restaurantId && Number(row._scopeScore || 0) >= minimum)
    .sort((left, right) => Number(right._scopeScore || 0) - Number(left._scopeScore || 0));
  if (!ranked.length) return null;

  const bestScore = Number(ranked[0]._scopeScore || 0);
  const strongRows = ranked
    .filter((row) => Number(row._scopeScore || 0) >= Math.max(minimum, bestScore * ratio))
    .slice(0, 12);
  const ownerIds = [...new Set(strongRows.map((row) => String(row.restaurantId || "")).filter(Boolean))];

  return ownerIds.length === 1 ? ownerIds[0] : null;
};

const loadEligibleRestaurants = async () => {
  const query = Restaurant.find(ELIGIBLE_RESTAURANT_FILTER)
    .sort({ avgRating: -1, reviewCount: -1, updatedAt: -1 })
    .limit(200);
  const rows = typeof query.lean === "function" ? await query.lean() : await query;
  return Array.isArray(rows) ? rows : [];
};

const loadLexicalKnowledgeRows = async ({ restaurantIds, message }) => {
  const objectIds = restaurantIds.map(toObjectId).filter(Boolean);
  if (!objectIds.length) return [];

  const baseFilter = {
    restaurantId: { $in: objectIds },
    enabled: true,
  };
  const tokens = tokenize(message);

  try {
    const textQuery = AiChatbotKnowledgeItem.find({
      ...baseFilter,
      $text: { $search: String(message || "").slice(0, 500) },
    })
      .sort({ score: { $meta: "textScore" }, priority: -1, updatedAt: -1 })
      .limit(40);
    const textRows = typeof textQuery.lean === "function" ? await textQuery.lean() : await textQuery;
    const scored = (Array.isArray(textRows) ? textRows : []).map((row) => ({
      ...row,
      _scopeScore: knowledgeTokenScore(row, tokens),
    }));
    if (scored.some((row) => row._scopeScore >= 2)) return scored;
  } catch {
    // Text search can be unavailable while an index is still being created.
  }

  const fallbackQuery = AiChatbotKnowledgeItem.find(baseFilter)
    .sort({ priority: -1, updatedAt: -1 })
    .limit(120);
  const fallbackRows = typeof fallbackQuery.lean === "function"
    ? await fallbackQuery.lean()
    : await fallbackQuery;

  return (Array.isArray(fallbackRows) ? fallbackRows : []).map((row) => ({
    ...row,
    _scopeScore: knowledgeTokenScore(row, tokens),
  }));
};

const loadSemanticKnowledgeRows = async ({ restaurantIds, message }) => {
  let queryEmbedding;
  try {
    queryEmbedding = await createEmbedding(message);
  } catch {
    return [];
  }
  if (!Array.isArray(queryEmbedding?.embedding) || !queryEmbedding.embedding.length) {
    return [];
  }

  const objectIds = restaurantIds.map(toObjectId).filter(Boolean);
  const query = AiChatbotKnowledgeItem.find({
    restaurantId: { $in: objectIds },
    enabled: true,
    embedding: { $exists: true, $ne: [] },
  })
    .sort({ priority: -1, updatedAt: -1 })
    .limit(160);
  const rows = typeof query.lean === "function" ? await query.lean() : await query;

  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...row,
      _scopeScore: cosineSimilarity(queryEmbedding.embedding, row.embedding || []),
    }))
    .filter((row) => row._scopeScore >= 0.35);
};

export async function findUniqueKnowledgeRestaurantId({ message, restaurantIds = [] } = {}) {
  const uniqueRestaurantIds = [...new Set(restaurantIds.map(String).filter((id) => mongoose.isValidObjectId(id)))];
  if (!String(message || "").trim() || !uniqueRestaurantIds.length) return null;

  const lexicalRows = await loadLexicalKnowledgeRows({
    restaurantIds: uniqueRestaurantIds,
    message,
  });
  const lexicalOwner = pickUniqueOwner(lexicalRows);
  if (lexicalOwner) return lexicalOwner;
  if (lexicalRows.some((row) => Number(row._scopeScore || 0) >= 2)) return null;

  const semanticRows = await loadSemanticKnowledgeRows({
    restaurantIds: uniqueRestaurantIds,
    message,
  });
  return pickUniqueOwner(semanticRows, { minimum: 0.35, ratio: 0.8 });
}

export async function resolveUniqueKnowledgeRestaurantOptions(options = {}) {
  try {
    const baseScope = await chatbotCoreTestables.resolveRestaurantScope({
      restaurantId: options.restaurantId,
      message: options.message,
      pageContext: options.pageContext || {},
      user: options.user || null,
    });

    if (baseScope?.mode !== "global" || baseScope?.reason !== "global") {
      return options;
    }

    const restaurants = await loadEligibleRestaurants();
    const restaurantId = await findUniqueKnowledgeRestaurantId({
      message: options.message,
      restaurantIds: restaurants.map((restaurant) => String(restaurant?._id || restaurant?.id || "")),
    });
    if (!restaurantId) return options;

    return {
      ...options,
      restaurantId,
      pageContext: {
        ...(options.pageContext || {}),
        restaurantId,
      },
    };
  } catch {
    return options;
  }
}

export const __testables = {
  normalizeText,
  tokenize,
  knowledgeTokenScore,
  cosineSimilarity,
  pickUniqueOwner,
  loadLexicalKnowledgeRows,
  loadSemanticKnowledgeRows,
  loadEligibleRestaurants,
};
