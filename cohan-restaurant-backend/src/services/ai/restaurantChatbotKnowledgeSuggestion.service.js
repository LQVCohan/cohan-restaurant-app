import mongoose from "mongoose";
import { AiChatbotKnowledgeItem, AiChatbotKnowledgeSuggestion } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission } from "../auth/authorization.service.js";
import { createRestaurantAiChatbotKnowledgeItem } from "./restaurantChatbotKnowledge.service.js";

const MAX_QUESTION = 500;
const MAX_TITLE = 160;
const MAX_CONTENT = 3000;
const MAX_CATEGORY = 80;
const MAX_TAG = 40;
const MAX_TAGS = 10;
const MIN_QUESTION_LEN = 6;
const TRIGGER_TYPES = new Set(["fallback", "low_confidence", "handoff", "no_knowledge_match"]);
const STATUSES = new Set(["pending", "approved", "dismissed"]);

const clean = (v, max) => String(v || "").trim().slice(0, max);
const toObjectId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const normalizeQuestion = (q) => clean(q, MAX_QUESTION).toLowerCase().replace(/\s+/g, " ").replace(/[!?.,;:]+/g, "").trim();
const isSensitiveQuestion = (q) => /\b\d{9,16}\b|@|\b(?:cccd|cmnd|visa|mastercard|otp|password|mật khẩu)\b/i.test(q);
const toTags = (tags) => (Array.isArray(tags) ? tags : []).map((t) => clean(t, MAX_TAG)).filter(Boolean).slice(0, MAX_TAGS);
const toDto = (row) => ({ ...row, id: String(row?._id || row?.id || ""), restaurantId: row?.restaurantId ? String(row.restaurantId) : "", approvedKnowledgeItemId: row?.approvedKnowledgeItemId ? String(row.approvedKnowledgeItemId) : null, tags: Array.isArray(row?.tags) ? row.tags : [], occurrenceCount: Number(row?.occurrenceCount || 1), status: STATUSES.has(row?.status) ? row.status : "pending" });

const ensureAuth = (ctx) => { if (!ctx?.user?.id && !ctx?.user?._id) throw Object.assign(new Error("Cần đăng nhập"), { code: "UNAUTHENTICATED" }); };
const ensurePermission = async (ctx, restaurantId, permissionCode) => { ensureAuth(ctx); await requireRestaurantPermission(ctx, restaurantId, permissionCode); };

export async function recordKnowledgeGapSuggestion({ restaurantId, question, triggerType, confidence, conversationId, messageId }) {
  const rid = toObjectId(restaurantId);
  const safeQuestion = clean(question, MAX_QUESTION);
  const normalizedQuestion = normalizeQuestion(safeQuestion);
  if (!rid || !TRIGGER_TYPES.has(String(triggerType || "")) || !normalizedQuestion || normalizedQuestion.length < MIN_QUESTION_LEN || isSensitiveQuestion(safeQuestion)) return null;

  const now = new Date();
  const found = await AiChatbotKnowledgeSuggestion.findOne({ restaurantId: rid, normalizedQuestion, status: "pending" });
  if (found) {
    found.occurrenceCount = Number(found.occurrenceCount || 1) + 1;
    found.lastAskedAt = now;
    found.triggerType = TRIGGER_TYPES.has(String(triggerType || "")) ? String(triggerType) : found.triggerType;
    if (Number.isFinite(Number(confidence))) found.confidence = Number(confidence);
    if (mongoose.isValidObjectId(conversationId)) found.sourceConversationId = toObjectId(conversationId);
    if (mongoose.isValidObjectId(messageId)) found.sourceMessageId = toObjectId(messageId);
    await found.save();
    return toDto(found.toObject());
  }

  const doc = await AiChatbotKnowledgeSuggestion.create({
    restaurantId: rid,
    question: safeQuestion,
    normalizedQuestion,
    triggerType: String(triggerType),
    confidence: Number.isFinite(Number(confidence)) ? Number(confidence) : null,
    sourceConversationId: toObjectId(conversationId),
    sourceMessageId: toObjectId(messageId),
    lastAskedAt: now,
  });
  return toDto(doc.toObject());
}

export async function listRestaurantAiChatbotKnowledgeSuggestions({ restaurantId, filter, ctx }) {
  await ensurePermission(ctx, restaurantId, PERMISSIONS.REPORT_READ);
  const q = { restaurantId: toObjectId(restaurantId) };
  if (filter?.status && STATUSES.has(filter.status)) q.status = filter.status;
  if (filter?.triggerType && TRIGGER_TYPES.has(filter.triggerType)) q.triggerType = filter.triggerType;
  if (filter?.search) q.question = new RegExp(clean(filter.search, 120).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const rows = await AiChatbotKnowledgeSuggestion.find(q).sort({ status: 1, lastAskedAt: -1, occurrenceCount: -1 }).lean();
  return rows.map(toDto);
}

export async function approveRestaurantAiChatbotKnowledgeSuggestion({ id, input, ctx }) {
  if (!mongoose.isValidObjectId(id)) throw Object.assign(new Error("id không hợp lệ"), { code: "BAD_USER_INPUT" });
  const found = await AiChatbotKnowledgeSuggestion.findById(id);
  if (!found) throw Object.assign(new Error("Không tìm thấy suggestion"), { code: "NOT_FOUND" });
  await ensurePermission(ctx, found.restaurantId, PERMISSIONS.RESTAURANT_WRITE);

  const created = await createRestaurantAiChatbotKnowledgeItem({
    input: {
      restaurantId: String(found.restaurantId),
      title: clean(input?.title || found.suggestedTitle || found.question, MAX_TITLE),
      content: clean(input?.content || found.suggestedContent || found.question, MAX_CONTENT),
      category: clean(input?.category || found.category, MAX_CATEGORY),
      tags: toTags(input?.tags || found.tags),
      enabled: input?.enabled != null ? Boolean(input.enabled) : true,
      priority: input?.priority,
      sourceType: input?.sourceType || "faq",
    },
    ctx,
  });

  found.status = "approved";
  found.approvedKnowledgeItemId = toObjectId(created.id);
  found.updatedBy = toObjectId(ctx?.user?.id || ctx?.user?._id);
  await found.save();
  return created;
}

export async function dismissRestaurantAiChatbotKnowledgeSuggestion({ id, ctx }) {
  if (!mongoose.isValidObjectId(id)) return false;
  const found = await AiChatbotKnowledgeSuggestion.findById(id);
  if (!found) return false;
  await ensurePermission(ctx, found.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  found.status = "dismissed";
  found.updatedBy = toObjectId(ctx?.user?.id || ctx?.user?._id);
  await found.save();
  return true;
}

export async function deleteRestaurantAiChatbotKnowledgeSuggestion({ id, ctx }) {
  if (!mongoose.isValidObjectId(id)) return false;
  const found = await AiChatbotKnowledgeSuggestion.findById(id).lean();
  if (!found) return false;
  await ensurePermission(ctx, found.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  await AiChatbotKnowledgeSuggestion.deleteOne({ _id: found._id });
  return true;
}
