import mongoose from "mongoose";
import { AiChatConversation } from "../../../models/index.js";

const HANDOFF_MARKER = "[AI HANDOFF]";

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

export const normalizeGuestId = (guestId) => {
  const value = String(guestId || "").trim().slice(0, 128);
  return value ? value.replace(/[^a-zA-Z0-9_-]/g, "") : "";
};

export const isValidConversationId = (conversationId) =>
  !!conversationId && mongoose.isValidObjectId(String(conversationId));

export const getAiConversationGuestRoomName = (conversationId) => `ai_conv_${String(conversationId)}`;

export async function validateGuestConversationOwnership({ conversationId, guestId } = {}) {
  const normalizedGuestId = normalizeGuestId(guestId);
  if (!isValidConversationId(conversationId) || !normalizedGuestId) {
    return { ok: false, code: "INVALID", normalizedGuestId: "", conversationId: "" };
  }

  const conversation = await AiChatConversation.findById(String(conversationId)).select("_id guestId").lean();
  if (!conversation || String(conversation.guestId || "") !== normalizedGuestId) {
    return { ok: false, code: "FORBIDDEN", normalizedGuestId, conversationId: String(conversationId) };
  }

  return {
    ok: true,
    code: "OK",
    normalizedGuestId,
    conversationId: String(conversation._id),
    roomName: getAiConversationGuestRoomName(conversation._id),
  };
}

const parseStaffReplyForGuest = (message, index = 0) => {
  const content = String(message?.content || "").trim();
  if (!content || content.includes(HANDOFF_MARKER)) return null;

  const senderRole = String(message?.senderRole || "").trim().toLowerCase();
  if (!senderRole || senderRole === "system" || CUSTOMER_DENYLIST.has(senderRole)) return null;
  if (!STAFF_ALLOWLIST.has(senderRole)) return null;
  if (!message?.senderId && !message?.senderName) return null;

  const createdAt = new Date(message?.createdAt || 0);
  if (Number.isNaN(createdAt.getTime())) return null;

  return {
    id: String(message?._id || `${createdAt.toISOString()}_${index}`),
    role: "staff",
    senderLabel: "Nhân viên",
    content,
    createdAt: createdAt.toISOString(),
  };
};

export const buildGuestSafeStaffReplyPayload = ({ message, fallbackIndex = 0 } = {}) =>
  parseStaffReplyForGuest(message, fallbackIndex);

export async function emitAiChatbotStaffReplyIfLinked({ io, chatThreadId, message } = {}) {
  if (!io || !chatThreadId || !message) return false;

  const conversation = await AiChatConversation.findOne({ chatThreadId }).select("_id").lean();
  if (!conversation?._id) return false;

  const payload = buildGuestSafeStaffReplyPayload({ message });
  if (!payload) return false;

  io.to(getAiConversationGuestRoomName(conversation._id)).emit("aiChatbotStaffReplyCreated", payload);
  return true;
}
