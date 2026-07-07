import mongoose from "mongoose";
import { AiChatConversation, ChatThread, Notification, User } from "../../../models/index.js";
import { normalizeGuestId, buildGuestSafeStaffReplyPayload } from "./restaurantChatbotRealtime.service.js";
import { AI_CHATBOT_RATE_LIMIT_POLICIES, consumeAiChatbotRateLimit } from "./restaurantChatbotRateLimit.service.js";

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

export async function getRestaurantChatbotGuestReplies({ input, clientIp } = {}) {
  const conversationId = String(input?.conversationId || "").trim();
  const normalizedGuestId = normalizeGuestId(input?.guestId);
  const conversationObjectId = safeObjectId(conversationId);

  const safeEmpty = {
    ok: false,
    handoffRequested: false,
    conversationStatus: null,
    handoffClosed: false,
    conversationId,
    replies: [],
  };

  const rateResult = consumeAiChatbotRateLimit({
    policy: AI_CHATBOT_RATE_LIMIT_POLICIES.aiChatbotGuestReplies,
    keyParts: {
      guestId: normalizedGuestId,
      conversationId,
      restaurantId: "",
      clientIp,
    },
  });
  if (!rateResult.allowed) {
    return { ...safeEmpty, ok: true };
  }

  if (!conversationObjectId || !normalizedGuestId) return safeEmpty;

  const conversation = await AiChatConversation.findById(conversationObjectId).lean();
  if (!conversation || String(conversation.guestId || "") !== normalizedGuestId) {
    return safeEmpty;
  }

  const hasHandoff = conversation.status === "handoff_requested";
  const isClosed = conversation.status === "closed";
  if (!hasHandoff && !conversation.chatThreadId) {
    return {
      ok: true,
      handoffRequested: false,
      conversationStatus: String(conversation.status || ""),
      handoffClosed: isClosed,
      conversationId: String(conversation._id),
      replies: [],
    };
  }

  if (!conversation.chatThreadId) {
    return {
      ok: true,
      handoffRequested: hasHandoff,
      conversationStatus: String(conversation.status || ""),
      handoffClosed: isClosed,
      conversationId: String(conversation._id),
      replies: [],
    };
  }

  const thread = await ChatThread.findById(conversation.chatThreadId).select("messages").lean();
  if (!thread) {
    return {
      ok: true,
      handoffRequested: hasHandoff,
      conversationStatus: String(conversation.status || ""),
      handoffClosed: isClosed,
      conversationId: String(conversation._id),
      replies: [],
    };
  }

  return {
    ok: true,
    handoffRequested: hasHandoff,
    conversationStatus: String(conversation.status || ""),
    handoffClosed: isClosed,
    conversationId: String(conversation._id),
    replies: toGuestStaffReplies({
      messages: thread.messages || [],
      after: input?.after,
      limit: input?.limit,
    }),
  };
}


const toObjectId = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(value);
};

const preview = (text, max = 140) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);

const resolveRecipientIdsByRole = async ({ thread, senderId }) => {
  const role = String(thread?.targetRole || "").toLowerCase();
  if (!role || !thread?.restaurantId) return [];

  const roleMap = {
    management: ["MANAGER", "ADMIN"],
    manager: ["MANAGER", "ADMIN"],
    kitchen: ["STAFF"],
    cashier: ["STAFF"],
    staff: ["STAFF"],
    support: ["STAFF", "MANAGER", "ADMIN"],
  };

  const userTypes = roleMap[role] || [String(thread.targetRole || "").toUpperCase()];
  const users = await User.find({
    userType: { $in: userTypes },
    restaurantForStaff: thread.restaurantId,
  }).select("_id").lean();

  return users.map((u) => String(u._id)).filter((id) => id !== String(senderId));
};

export async function sendRestaurantChatbotGuestMessage({ input, io, clientIp } = {}) {
  const conversationId = String(input?.conversationId || "").trim();
  const normalizedGuestId = normalizeGuestId(input?.guestId);
  const content = String(input?.content || "").trim();
  const safeEmpty = { ok: false, conversationId, message: null };

  const rateResult = consumeAiChatbotRateLimit({
    policy: AI_CHATBOT_RATE_LIMIT_POLICIES.sendAiChatbotGuestMessage,
    keyParts: { guestId: normalizedGuestId, conversationId, restaurantId: "", clientIp },
  });
  if (!rateResult.allowed) return { ...safeEmpty, message: { id: "", role: "assistant", senderLabel: "", content: rateResult.safeMessage, createdAt: "" } };

  if (!safeObjectId(conversationId) || !normalizedGuestId) return safeEmpty;
  if (!content || content.length > 1000) return safeEmpty;

  const conversation = await AiChatConversation.findById(conversationId);
  if (!conversation || String(conversation.guestId || "") !== normalizedGuestId) return safeEmpty;
  if (conversation.status !== "handoff_requested") return { ok: false, conversationId: String(conversation._id), message: null };
  if (!conversation.chatThreadId) return { ok: false, conversationId: String(conversation._id), message: null };

  const thread = await ChatThread.findById(conversation.chatThreadId);
  if (!thread) return { ok: false, conversationId: String(conversation._id), message: null };

  const createdAt = new Date();
  const message = {
    senderRole: "guest",
    senderName: "Khách hàng",
    messageType: "text",
    content,
    createdAt,
  };

  thread.messages.push(message);
  thread.lastMessageAt = createdAt;
  thread.lastMessagePreview = preview(content, 140);

  const directRecipientIds = (thread.participants || []).map((id) => String(id));
  const roleRecipientIds = await resolveRecipientIdsByRole({ thread, senderId: `guest:${normalizedGuestId}` });
  const recipientIds = [...new Set([...directRecipientIds, ...roleRecipientIds])];

  thread.unreadBy = recipientIds.map((id) => toObjectId(id)).filter(Boolean);
  await thread.save();

  if (recipientIds.length > 0) {
    try {
      await Notification.insertMany(
        recipientIds.map((toUserId) => ({
          toUserId,
          toRole: thread.targetRole || null,
          restaurantId: thread.restaurantId,
          type: "chat_message",
          payload: {
            threadId: String(thread._id),
            channel: thread.channel,
            senderId: null,
            senderName: "Khách hàng",
            messagePreview: thread.lastMessagePreview,
          },
        }))
      );
    } catch {
      // best effort notification only
    }
  }

  if (io) {
    try {
      io.to(`chat_thread_${thread._id}`).emit("chatMessageCreated", {
        threadId: String(thread._id),
        restaurantId: String(thread.restaurantId || ""),
        message,
      });
      io.to(`restaurant_${thread.restaurantId}`).emit("threadUpdated", {
        threadId: String(thread._id),
        lastMessagePreview: thread.lastMessagePreview,
        lastMessageAt: thread.lastMessageAt,
      });
      recipientIds.forEach((uid) => {
        io.to(`user_${uid}`).emit("notificationCreated", {
          type: "chat_message",
          threadId: String(thread._id),
          messagePreview: thread.lastMessagePreview,
        });
      });
    } catch {
      // best effort realtime only
    }
  }

  return {
    ok: true,
    conversationId: String(conversation._id),
    message: {
      id: `${createdAt.toISOString()}_${thread.messages.length - 1}`,
      role: "guest",
      senderLabel: "Khách hàng",
      content,
      createdAt: createdAt.toISOString(),
    },
  };
}
