import mongoose from "mongoose";
import { AiChatbotKnowledgeItem } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission } from "../auth/authorization.service.js";

const MAX_TAGS = 10;
const MAX_TITLE = 160;
const MAX_CONTENT = 3000;
const MAX_CATEGORY = 80;
const MAX_TAG = 40;
const PRIORITY_MIN = 0;
const PRIORITY_MAX = 100;
const SOURCE_TYPES = new Set(["manual", "faq", "policy"]);

const toObjectId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const clean = (v, max) => String(v || "").trim().slice(0, max);
const clampPriority = (v) => Math.min(PRIORITY_MAX, Math.max(PRIORITY_MIN, Number.isFinite(Number(v)) ? Number(v) : 0));
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
  if (!ctx?.user?.id && !ctx?.user?._id) throw Object.assign(new Error("Cần đăng nhập"), { code: "UNAUTHENTICATED" });
};
const ensureRestaurantPermission = async (ctx, restaurantId, permissionCode) => {
  ensureAuth(ctx);
  if (!mongoose.isValidObjectId(restaurantId)) throw Object.assign(new Error("restaurantId không hợp lệ"), { code: "BAD_USER_INPUT" });
  await requireRestaurantPermission(ctx, restaurantId, permissionCode);
};

const sanitizeInput = (input = {}, { partial = false } = {}) => {
  const patch = {};
  if (!partial || input.title != null) {
    const title = clean(input.title, MAX_TITLE);
    if (!title && !partial) throw Object.assign(new Error("title là bắt buộc"), { code: "BAD_USER_INPUT" });
    if (title) patch.title = title;
  }
  if (!partial || input.content != null) {
    const content = clean(input.content, MAX_CONTENT);
    if (!content && !partial) throw Object.assign(new Error("content là bắt buộc"), { code: "BAD_USER_INPUT" });
    if (content) patch.content = content;
  }
  if (!partial || input.category != null) patch.category = clean(input.category, MAX_CATEGORY);
  if (!partial || input.tags != null) patch.tags = normalizeTags(input.tags);
  if (!partial || input.enabled != null) patch.enabled = Boolean(input.enabled);
  if (!partial || input.priority != null) patch.priority = clampPriority(input.priority);
  if (!partial || input.sourceType != null) {
    const sourceType = clean(input.sourceType || "manual", 20).toLowerCase();
    patch.sourceType = SOURCE_TYPES.has(sourceType) ? sourceType : "manual";
  }
  return patch;
};

export async function listRestaurantAiChatbotKnowledge({ restaurantId, filter, ctx }) {
  await ensureRestaurantPermission(ctx, restaurantId, PERMISSIONS.REPORT_READ);
  const rid = toObjectId(restaurantId);
  const q = { restaurantId: rid };
  if (filter?.enabled != null) q.enabled = Boolean(filter.enabled);
  if (filter?.category) q.category = clean(filter.category, MAX_CATEGORY);
  if (filter?.search) {
    const search = clean(filter.search, 80);
    if (search) q.$text = { $search: search };
  }
  return AiChatbotKnowledgeItem.find(q).sort(filter?.search ? { score: { $meta: "textScore" }, priority: -1, updatedAt: -1 } : { priority: -1, updatedAt: -1 }).lean();
}

export async function getRestaurantAiChatbotKnowledgeItem({ id, ctx }) {
  ensureAuth(ctx);
  if (!mongoose.isValidObjectId(id)) return null;
  const item = await AiChatbotKnowledgeItem.findById(id).lean();
  if (!item) return null;
  await ensureRestaurantPermission(ctx, item.restaurantId, PERMISSIONS.REPORT_READ);
  return item;
}

export async function createRestaurantAiChatbotKnowledgeItem({ input, ctx }) {
  const restaurantId = input?.restaurantId;
  await ensureRestaurantPermission(ctx, restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  const doc = await AiChatbotKnowledgeItem.create({
    restaurantId: toObjectId(restaurantId),
    ...sanitizeInput(input),
    createdBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
    updatedBy: toObjectId(ctx?.user?.id || ctx?.user?._id),
  });
  return doc.toObject();
}

export async function updateRestaurantAiChatbotKnowledgeItem({ input, ctx }) {
  if (!mongoose.isValidObjectId(input?.id)) throw Object.assign(new Error("id không hợp lệ"), { code: "BAD_USER_INPUT" });
  const found = await AiChatbotKnowledgeItem.findById(input.id);
  if (!found) throw Object.assign(new Error("Không tìm thấy dữ liệu"), { code: "NOT_FOUND" });
  await ensureRestaurantPermission(ctx, found.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  Object.assign(found, sanitizeInput(input, { partial: true }), { updatedBy: toObjectId(ctx?.user?.id || ctx?.user?._id) });
  await found.save();
  return found.toObject();
}

export async function deleteRestaurantAiChatbotKnowledgeItem({ id, ctx }) {
  if (!mongoose.isValidObjectId(id)) return false;
  const found = await AiChatbotKnowledgeItem.findById(id).lean();
  if (!found) return false;
  await ensureRestaurantPermission(ctx, found.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  await AiChatbotKnowledgeItem.deleteOne({ _id: found._id });
  return true;
}

const tokenize = (message) => String(message || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).map((s) => s.trim()).filter((s) => s.length >= 2).slice(0, 12);
const scoreByTokens = (item, tokens) => {
  const text = `${item.title || ""} ${item.content || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
  let score = Number(item.priority || 0) * 0.2;
  for (const tk of tokens) {
    if ((item.title || "").toLowerCase().includes(tk)) score += 5;
    if ((item.tags || []).some((t) => String(t).toLowerCase().includes(tk))) score += 3;
    if (text.includes(tk)) score += 1;
  }
  return score;
};

export async function findRelevantKnowledgeForChatbot({ restaurantId, message, limit = 4 }) {
  const rid = toObjectId(restaurantId);
  if (!rid) return [];
  const safeLimit = Math.min(5, Math.max(1, Number(limit) || 4));
  const query = { restaurantId: rid, enabled: true };
  const search = clean(message, 120);
  if (search) {
    const textRows = await AiChatbotKnowledgeItem.find({ ...query, $text: { $search: search } })
      .sort({ score: { $meta: "textScore" }, priority: -1, updatedAt: -1 })
      .limit(safeLimit)
      .lean();
    if (textRows.length) return textRows;
  }
  const rows = await AiChatbotKnowledgeItem.find(query).sort({ priority: -1, updatedAt: -1 }).limit(50).lean();
  const tokens = tokenize(message);
  return rows
    .map((item) => ({ item, score: scoreByTokens(item, tokens) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, safeLimit)
    .map((row) => row.item);
}
