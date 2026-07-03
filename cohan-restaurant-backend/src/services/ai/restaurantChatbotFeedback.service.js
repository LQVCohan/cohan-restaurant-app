import mongoose from "mongoose";
import {
  AiChatConversation,
  AiChatMessage,
  AiChatbotAnswerFeedback,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  requireAnyRestaurantPermission,
  requireRestaurantPermission,
} from "../auth/authorization.service.js";
import { recordKnowledgeGapSuggestion } from "./restaurantChatbotKnowledgeSuggestion.service.js";

const clean = (v, max) =>
  String(v || "")
    .trim()
    .slice(0, max);
const toObjectId = (id) =>
  id && mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;
const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const toTags = (arr) =>
  (Array.isArray(arr) ? arr : [])
    .map((x) => clean(x, 40))
    .filter(Boolean)
    .slice(0, 10);
const ensureRating = (r) =>
  ["helpful", "not_helpful"].includes(String(r || ""));
const toDto = (row) => ({
  ...row,
  id: String(row?._id || row?.id || ""),
  restaurantId: row?.restaurantId ? String(row.restaurantId) : null,
  conversationId: row?.conversationId ? String(row.conversationId) : null,
  messageId: row?.messageId ? String(row.messageId) : null,
  userId: row?.userId ? String(row.userId) : null,
  reviewedBy: row?.reviewedBy ? String(row.reviewedBy) : null,
});

const buildConversationOwnerQuery = ({
  conversationId,
  restaurantId,
  guestId,
  userId,
}) => {
  const cid = toObjectId(conversationId);
  if (!cid) return null;

  const q = { _id: cid };
  if (restaurantId) q.restaurantId = restaurantId;
  if (userId) {
    const uid = toObjectId(userId);
    if (!uid) return null;
    q.userId = uid;
  } else {
    const safeGuestId = clean(guestId, 128);
    if (!safeGuestId) return null;
    q.guestId = safeGuestId;
  }
  return q;
};

async function resolveSubmitContext({
  restaurantId,
  conversationId,
  messageId,
  guestId,
  userId,
}) {
  const explicitRestaurantId = toObjectId(restaurantId);
  if (restaurantId && !explicitRestaurantId)
    return { ok: false, restaurantId: null };

  if (!conversationId && !messageId) {
    return explicitRestaurantId
      ? { ok: true, restaurantId: explicitRestaurantId }
      : { ok: false, restaurantId: null };
  }

  let conversation = null;
  if (conversationId) {
    const q = buildConversationOwnerQuery({
      conversationId,
      restaurantId: explicitRestaurantId,
      guestId,
      userId,
    });
    if (!q) return { ok: false, restaurantId: null };
    conversation = await AiChatConversation.findOne(q).lean();
    if (!conversation) return { ok: false, restaurantId: null };
  }

  let message = null;
  if (messageId) {
    const mid = toObjectId(messageId);
    if (!mid) return { ok: false, restaurantId: null };
    message = await AiChatMessage.findById(mid).lean();
    if (!message || String(message.role || "") !== "assistant") {
      return { ok: false, restaurantId: null };
    }

    if (
      explicitRestaurantId &&
      String(message.restaurantId || "") !== String(explicitRestaurantId)
    ) {
      return { ok: false, restaurantId: null };
    }

    if (conversation) {
      if (String(message.conversationId || "") !== String(conversation._id)) {
        return { ok: false, restaurantId: null };
      }
    } else if (message.conversationId) {
      const q = buildConversationOwnerQuery({
        conversationId: message.conversationId,
        restaurantId: explicitRestaurantId,
        guestId,
        userId,
      });
      if (!q) return { ok: false, restaurantId: null };
      conversation = await AiChatConversation.findOne(q).lean();
      if (!conversation) return { ok: false, restaurantId: null };
    } else {
      return { ok: false, restaurantId: null };
    }
  }

  if (!conversation && !message) return { ok: false, restaurantId: null };

  return {
    ok: true,
    restaurantId:
      explicitRestaurantId ||
      toObjectId(message?.restaurantId) ||
      toObjectId(conversation?.restaurantId) ||
      null,
  };
}

export async function submitAiChatbotAnswerFeedback({ input, ctx }) {
  if (!ensureRating(input?.rating))
    throw Object.assign(new Error("rating không hợp lệ"), {
      code: "BAD_USER_INPUT",
    });
  const guestId = clean(input?.guestId, 128).replace(/[^a-zA-Z0-9_-]/g, "");
  const userId = ctx?.user?.id || ctx?.user?._id;
  const submitContext = await resolveSubmitContext({
    restaurantId: input?.restaurantId,
    conversationId: input?.conversationId,
    messageId: input?.messageId,
    guestId,
    userId,
  });
  if (!submitContext.ok)
    throw Object.assign(new Error("Không thể xác minh phản hồi"), {
      code: "BAD_USER_INPUT",
    });

  const doc = await AiChatbotAnswerFeedback.create({
    restaurantId: submitContext.restaurantId,
    conversationId: toObjectId(input?.conversationId),
    messageId: toObjectId(input?.messageId),
    guestId,
    userId: toObjectId(userId),
    question: clean(input?.question, 500),
    answer: clean(input?.answer, 3000),
    rating: String(input?.rating),
    reason: clean(input?.reason, 500),
    tags: toTags(input?.tags),
    confidence: Number.isFinite(Number(input?.confidence))
      ? Number(input.confidence)
      : null,
  });
  return toDto(doc.toObject());
}

export async function listRestaurantAiChatbotAnswerFeedback({
  restaurantId,
  filter,
  ctx,
}) {
  await requireAnyRestaurantPermission(ctx, restaurantId, [
    PERMISSIONS.AI_CHATBOT_MODERATE,
    PERMISSIONS.AI_CHATBOT_READ,
  ]);
  const rid = toObjectId(restaurantId);
  const q = { restaurantId: rid };
  if (ensureRating(filter?.rating)) q.rating = filter.rating;
  if (
    ["new", "reviewed", "converted_to_suggestion", "ignored"].includes(
      String(filter?.status),
    )
  )
    q.status = filter.status;
  if (filter?.search) {
    const text = escapeRegex(clean(filter.search, 120));
    q.$or = [
      { question: new RegExp(text, "i") },
      { answer: new RegExp(text, "i") },
      { reason: new RegExp(text, "i") },
    ];
  }
  if (filter?.from || filter?.to)
    q.createdAt = {
      ...(filter?.from ? { $gte: new Date(filter.from) } : {}),
      ...(filter?.to ? { $lte: new Date(filter.to) } : {}),
    };
  const rows = await AiChatbotAnswerFeedback.find(q)
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();
  return rows.map(toDto);
}

async function updateStatus({ id, ctx, status }) {
  const row = await AiChatbotAnswerFeedback.findById(id);
  if (!row) return false;
  await requireRestaurantPermission(
    ctx,
    row.restaurantId,
    PERMISSIONS.AI_CHATBOT_MODERATE,
  );
  row.status = status;
  row.reviewedBy = toObjectId(ctx?.user?.id || ctx?.user?._id);
  row.reviewedAt = new Date();
  await row.save();
  return true;
}

export const markAiChatbotAnswerFeedbackReviewed = ({ id, ctx }) =>
  updateStatus({ id, ctx, status: "reviewed" });
export const ignoreAiChatbotAnswerFeedback = ({ id, ctx }) =>
  updateStatus({ id, ctx, status: "ignored" });

export async function convertAiChatbotFeedbackToSuggestion({ id, ctx }) {
  const row = await AiChatbotAnswerFeedback.findById(id);
  if (!row) return false;
  await requireRestaurantPermission(
    ctx,
    row.restaurantId,
    PERMISSIONS.AI_CHATBOT_MODERATE,
  );
  await recordKnowledgeGapSuggestion({
    restaurantId: String(row.restaurantId),
    question: row.question || row.reason || "Chatbot answer not helpful",
    triggerType: "low_confidence",
    confidence: row.confidence,
    conversationId: row.conversationId,
    messageId: row.messageId,
  });
  row.status = "converted_to_suggestion";
  row.reviewedBy = toObjectId(ctx?.user?.id || ctx?.user?._id);
  row.reviewedAt = new Date();
  await row.save();
  return true;
}

export async function bulkMarkAiChatbotAnswerFeedbackReviewed({
  ids = [],
  ctx,
}) {
  for (const id of ids) {
    if (mongoose.isValidObjectId(id))
      await markAiChatbotAnswerFeedbackReviewed({ id, ctx });
  }
  return true;
}

export async function bulkIgnoreAiChatbotAnswerFeedback({ ids = [], ctx }) {
  for (const id of ids) {
    if (mongoose.isValidObjectId(id))
      await ignoreAiChatbotAnswerFeedback({ id, ctx });
  }
  return true;
}

export async function bulkConvertAiChatbotFeedbackToSuggestion({
  ids = [],
  ctx,
}) {
  for (const id of ids) {
    if (mongoose.isValidObjectId(id))
      await convertAiChatbotFeedbackToSuggestion({ id, ctx });
  }
  return true;
}
