import mongoose from "mongoose";
import { AiChatConversation, ChatThread } from "../../../models/index.js";
import { normalizeGuestId, buildGuestSafeStaffReplyPayload } from "./restaurantChatbotRealtime.service.js";

const HANDOFF_MARKER = "[AI HANDOFF]";


const safeObjectId = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const STAFF_ALLOWLIST = new Set([
  "staff",
  "manager",
  "admin",
  "support",
  "employee",
  "server",
  "supervisor",
  "host",
  "cashier",
  "chef",
  "cook",
  "kitchen_helper",
  "cleaner",
  "shipper",
  "storekeeper",
  "bartender",
  "hr",
  "accountant",
]);
const CUSTOMER_DENYLIST = new Set(["guest", "customer", "user"]);

const parseAfterDate = (after) => {
  if (!after) return null;
  const date = new Date(after);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const toGuestStaffReplies = ({ messages = [], after = null, limit = 30 } = {}) => {
  const parsedAfter = parseAfterDate(after);
  const max = Math.max(1, Math.min(Number(limit || 30), 50));

  return messages
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => {
      const content = String(message?.content || "").trim();
      if (!content) return false;
      if (content.includes(HANDOFF_MARKER)) return false;

      const senderRole = String(message?.senderRole || "").trim().toLowerCase();
      if (!senderRole || senderRole === "system" || CUSTOMER_DENYLIST.has(senderRole)) return false;
      if (!STAFF_ALLOWLIST.has(senderRole)) return false;
      if (!message?.senderId && !message?.senderName) return false;

      const createdAt = new Date(message?.createdAt || 0);
      if (Number.isNaN(createdAt.getTime())) return false;
      if (parsedAfter && createdAt <= parsedAfter) return false;
      return true;
    })
    .slice(-max)
    .map(({ message, index }) => buildGuestSafeStaffReplyPayload({ message, fallbackIndex: index }))
    .filter(Boolean);
};

export async function getRestaurantChatbotGuestReplies({ input } = {}) {
  const conversationId = String(input?.conversationId || "").trim();
  const normalizedGuestId = normalizeGuestId(input?.guestId);
  const conversationObjectId = safeObjectId(conversationId);

  const safeEmpty = {
    ok: false,
    handoffRequested: false,
    conversationId,
    replies: [],
  };

  if (!conversationObjectId || !normalizedGuestId) return safeEmpty;

  const conversation = await AiChatConversation.findById(conversationObjectId).lean();
  if (!conversation || String(conversation.guestId || "") !== normalizedGuestId) {
    return safeEmpty;
  }

  const hasHandoff = conversation.status === "handoff_requested";
  if (!hasHandoff && !conversation.chatThreadId) {
    return { ok: true, handoffRequested: false, conversationId: String(conversation._id), replies: [] };
  }

  if (!conversation.chatThreadId) {
    return { ok: true, handoffRequested: true, conversationId: String(conversation._id), replies: [] };
  }

  const thread = await ChatThread.findById(conversation.chatThreadId).select("messages").lean();
  if (!thread) {
    return { ok: true, handoffRequested: hasHandoff, conversationId: String(conversation._id), replies: [] };
  }

  return {
    ok: true,
    handoffRequested: hasHandoff,
    conversationId: String(conversation._id),
    replies: toGuestStaffReplies({
      messages: thread.messages || [],
      after: input?.after,
      limit: input?.limit,
    }),
  };
}
