import mongoose from "mongoose";
import { AiChatConversation, AiChatMessage, AiChatbotAnswerFeedback } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission } from "../auth/authorization.service.js";
import { recordKnowledgeGapSuggestion } from "./restaurantChatbotKnowledgeSuggestion.service.js";

const clean = (v, max) => String(v || "").trim().slice(0, max);
const toObjectId = (id) => (id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null);
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toTags = (arr) => (Array.isArray(arr) ? arr : []).map((x) => clean(x, 40)).filter(Boolean).slice(0, 10);
const ensureRating = (r) => ["helpful", "not_helpful"].includes(String(r || ""));
const toDto = (row) => ({ ...row, id: String(row?._id || row?.id || ""), restaurantId: row?.restaurantId ? String(row.restaurantId) : "", conversationId: row?.conversationId ? String(row.conversationId) : null, messageId: row?.messageId ? String(row.messageId) : null, userId: row?.userId ? String(row.userId) : null, reviewedBy: row?.reviewedBy ? String(row.reviewedBy) : null });

async function ensureSubmitOwnership({ restaurantId, conversationId, messageId, guestId, userId }) {
  if (!conversationId && !messageId) return true;
  const rid = toObjectId(restaurantId);
  if (!rid) return false;

  let conversation = null;
  if (conversationId) {
    const cid = toObjectId(conversationId);
    if (!cid) return false;
    const q = { _id: cid, restaurantId: rid };
    if (userId) q.userId = toObjectId(userId);
    else q.guestId = clean(guestId, 128);
    conversation = await AiChatConversation.findOne(q).lean();
    if (!conversation) return false;
  }

  if (messageId) {
    const mid = toObjectId(messageId);
    if (!mid) return false;
    const message = await AiChatMessage.findById(mid).lean();
    if (!message) return false;
    if (String(message.role || "") !== "assistant") return false;
    if (String(message.restaurantId || "") !== String(rid)) return false;

    if (conversationId) {
      if (String(message.conversationId || "") !== String(conversation._id)) return false;
    } else if (message.conversationId) {
      const msgConversation = await AiChatConversation.findById(message.conversationId).lean();
      if (!msgConversation) return false;
      if (String(msgConversation.restaurantId || "") !== String(rid)) return false;
      if (userId && String(msgConversation.userId || "") !== String(toObjectId(userId))) return false;
      if (!userId && String(msgConversation.guestId || "") !== clean(guestId, 128)) return false;
    }
  }

  return true;
}

export async function submitAiChatbotAnswerFeedback({ input, ctx }) {
  const restaurantId = toObjectId(input?.restaurantId);
  if (!restaurantId) throw Object.assign(new Error("restaurantId không hợp lệ"), { code: "BAD_USER_INPUT" });
  if (!ensureRating(input?.rating)) throw Object.assign(new Error("rating không hợp lệ"), { code: "BAD_USER_INPUT" });
  const guestId = clean(input?.guestId, 128).replace(/[^a-zA-Z0-9_-]/g, "");
  const userId = ctx?.user?.id || ctx?.user?._id;
  const ok = await ensureSubmitOwnership({ restaurantId, conversationId: input?.conversationId, messageId: input?.messageId, guestId, userId });
  if (!ok) throw Object.assign(new Error("Không thể xác minh phản hồi"), { code: "BAD_USER_INPUT" });

  const doc = await AiChatbotAnswerFeedback.create({
    restaurantId,
    conversationId: toObjectId(input?.conversationId),
    messageId: toObjectId(input?.messageId),
    guestId,
    userId: toObjectId(userId),
    question: clean(input?.question, 500),
    answer: clean(input?.answer, 3000),
    rating: String(input?.rating),
    reason: clean(input?.reason, 500),
    tags: toTags(input?.tags),
    confidence: Number.isFinite(Number(input?.confidence)) ? Number(input.confidence) : null,
  });
  return toDto(doc.toObject());
}

export async function listRestaurantAiChatbotAnswerFeedback({ restaurantId, filter, ctx }) {
  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.REPORT_READ);
  const rid = toObjectId(restaurantId);
  const q = { restaurantId: rid };
  if (ensureRating(filter?.rating)) q.rating = filter.rating;
  if (["new", "reviewed", "converted_to_suggestion", "ignored"].includes(String(filter?.status))) q.status = filter.status;
  if (filter?.search) {
    const text = escapeRegex(clean(filter.search, 120));
    q.$or = [{ question: new RegExp(text, "i") }, { answer: new RegExp(text, "i") }, { reason: new RegExp(text, "i") }];
  }
  if (filter?.from || filter?.to) q.createdAt = { ...(filter?.from ? { $gte: new Date(filter.from) } : {}), ...(filter?.to ? { $lte: new Date(filter.to) } : {}) };
  const rows = await AiChatbotAnswerFeedback.find(q).sort({ createdAt: -1 }).limit(300).lean();
  return rows.map(toDto);
}

async function updateStatus({ id, ctx, status }) {
  const row = await AiChatbotAnswerFeedback.findById(id);
  if (!row) return false;
  await requireRestaurantPermission(ctx, row.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  row.status = status;
  row.reviewedBy = toObjectId(ctx?.user?.id || ctx?.user?._id);
  row.reviewedAt = new Date();
  await row.save();
  return true;
}

export const markAiChatbotAnswerFeedbackReviewed = ({ id, ctx }) => updateStatus({ id, ctx, status: "reviewed" });
export const ignoreAiChatbotAnswerFeedback = ({ id, ctx }) => updateStatus({ id, ctx, status: "ignored" });

export async function convertAiChatbotFeedbackToSuggestion({ id, ctx }) {
  const row = await AiChatbotAnswerFeedback.findById(id);
  if (!row) return false;
  await requireRestaurantPermission(ctx, row.restaurantId, PERMISSIONS.RESTAURANT_WRITE);
  await recordKnowledgeGapSuggestion({ restaurantId: String(row.restaurantId), question: row.question || row.reason || "Chatbot answer not helpful", triggerType: "low_confidence", confidence: row.confidence, conversationId: row.conversationId, messageId: row.messageId });
  row.status = "converted_to_suggestion";
  row.reviewedBy = toObjectId(ctx?.user?.id || ctx?.user?._id);
  row.reviewedAt = new Date();
  await row.save();
  return true;
}


export async function bulkMarkAiChatbotAnswerFeedbackReviewed({ ids = [], ctx }) { for (const id of ids) { if (mongoose.isValidObjectId(id)) await markAiChatbotAnswerFeedbackReviewed({ id, ctx }); } return true; }
export async function bulkIgnoreAiChatbotAnswerFeedback({ ids = [], ctx }) { for (const id of ids) { if (mongoose.isValidObjectId(id)) await ignoreAiChatbotAnswerFeedback({ id, ctx }); } return true; }
export async function bulkConvertAiChatbotFeedbackToSuggestion({ ids = [], ctx }) { for (const id of ids) { if (mongoose.isValidObjectId(id)) await convertAiChatbotFeedbackToSuggestion({ id, ctx }); } return true; }
