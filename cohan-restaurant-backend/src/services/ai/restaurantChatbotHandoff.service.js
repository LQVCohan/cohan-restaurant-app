import mongoose from "mongoose";
import {
  AiChatConversation,
  AiChatMessage,
  ChatThread,
  Notification,
  User,
} from "../../../models/index.js";

const toObjectId = (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

const normalizeGuestId = (guestId) => {
  const value = String(guestId || "").trim().slice(0, 128);
  return value ? value.replace(/[^a-zA-Z0-9_-]/g, "") : "";
};

const preview = (text, max = 240) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);

const buildSummary = ({ conversation, guestId, reason, latestUserMessage, messages }) => {
  const lines = [];
  lines.push("[AI HANDOFF]");
  lines.push(`conversationId: ${String(conversation._id)}`);
  if (conversation.restaurantId) lines.push(`restaurantId: ${String(conversation.restaurantId)}`);
  if (conversation.userId) lines.push(`userId: ${String(conversation.userId)}`);
  if (guestId) lines.push(`guestId: ${guestId}`);
  if (reason) lines.push(`reason: ${reason}`);
  if (latestUserMessage) lines.push(`latestUserMessage: ${preview(latestUserMessage, 300)}`);
  lines.push("--- Recent AI conversation ---");
  for (const m of messages) {
    const role = m.role === "assistant" ? "Assistant" : m.role === "user" ? "User" : "System";
    lines.push(`${role}: ${preview(m.content, 400)}`);
  }
  return lines.join("\n");
};

const ensureOwnership = (conversation, { user, guestId }) => {
  if (!conversation) return false;
  if (user?.id || user?._id) return String(conversation.userId || "") === String(user.id || user._id);
  return !!guestId && String(conversation.guestId || "") === String(guestId);
};

export async function requestRestaurantChatbotHandoff({ input, user, io } = {}) {
  const conversationId = String(input?.conversationId || "").trim();
  const normalizedGuestId = normalizeGuestId(input?.guestId);
  const restaurantIdInput = toObjectId(input?.restaurantId);
  const reason = String(input?.reason || "user_click").trim().slice(0, 80);
  const latestUserMessage = String(input?.latestUserMessage || "").trim().slice(0, 500);

  if (!toObjectId(conversationId)) {
    return { ok: false, conversationId, handoffRequested: false, chatThreadId: null, notificationCount: 0, message: "Yêu cầu không hợp lệ.", alreadyRequested: false };
  }

  const conversation = await AiChatConversation.findById(conversationId);
  if (!ensureOwnership(conversation, { user, guestId: normalizedGuestId })) {
    return { ok: false, conversationId, handoffRequested: false, chatThreadId: null, notificationCount: 0, message: "Không thể xử lý yêu cầu hỗ trợ cho hội thoại này.", alreadyRequested: false };
  }

  if (restaurantIdInput && String(restaurantIdInput) !== String(conversation.restaurantId || "")) {
    return { ok: false, conversationId, handoffRequested: false, chatThreadId: null, notificationCount: 0, message: "Không thể xử lý yêu cầu hỗ trợ cho hội thoại này.", alreadyRequested: false };
  }

  if (!conversation.restaurantId) {
    return { ok: false, conversationId, handoffRequested: false, chatThreadId: null, notificationCount: 0, message: "Hiện chưa xác định được nhà hàng để chuyển nhân viên hỗ trợ.", alreadyRequested: false };
  }

  if (conversation.status === "handoff_requested" && conversation.chatThreadId) {
    return { ok: true, conversationId: String(conversation._id), handoffRequested: true, chatThreadId: String(conversation.chatThreadId), notificationCount: 0, message: "Yêu cầu hỗ trợ đã được ghi nhận trước đó.", alreadyRequested: true };
  }

  const recentMessages = await AiChatMessage.find({ conversationId: conversation._id }).sort({ createdAt: -1 }).limit(8).lean();
  const sortedMessages = [...recentMessages].reverse();
  const summaryText = buildSummary({
    conversation,
    guestId: normalizedGuestId,
    reason,
    latestUserMessage,
    messages: sortedMessages,
  });

  let thread = null;
  if (conversation.chatThreadId) {
    thread = await ChatThread.findById(conversation.chatThreadId);
  }

  if (!thread) {
    thread = await ChatThread.create({
      restaurantId: conversation.restaurantId,
      channel: "support",
      targetRole: "support",
      participants: [],
      subject: "AI handoff - Khách cần hỗ trợ",
      status: "open",
      messages: [
        {
          senderRole: "system",
          senderName: "AI Chatbot",
          messageType: "text",
          content: summaryText,
          createdAt: new Date(),
        },
      ],
      lastMessageAt: new Date(),
      lastMessagePreview: preview(summaryText, 140),
      unreadBy: [],
    });
  }

  const recipientUsers = await User.find({
    userType: { $in: ["STAFF", "MANAGER", "ADMIN"] },
    $or: [{ restaurantForStaff: conversation.restaurantId }, { refRestaurants: conversation.restaurantId }],
  })
    .select("_id userType")
    .lean();

  const recipientIds = [...new Set(recipientUsers.map((u) => String(u._id)))];
  let notifications = [];
  if (recipientIds.length > 0) {
    notifications = recipientIds.map((toUserId) => ({
      toUserId,
      toRole: "support",
      restaurantId: conversation.restaurantId,
      type: "ai_chatbot_handoff",
      payload: {
        threadId: String(thread._id),
        conversationId: String(conversation._id),
        guestId: normalizedGuestId || null,
        restaurantId: String(conversation.restaurantId),
        source: "ai_chatbot",
        messagePreview: preview(summaryText, 160),
      },
    }));
  } else {
    notifications = [{
      toRole: "manager",
      restaurantId: conversation.restaurantId,
      type: "ai_chatbot_handoff",
      payload: {
        threadId: String(thread._id),
        conversationId: String(conversation._id),
        guestId: normalizedGuestId || null,
        restaurantId: String(conversation.restaurantId),
        source: "ai_chatbot",
        messagePreview: preview(summaryText, 160),
      },
    }];
  }

  if (notifications.length > 0) await Notification.insertMany(notifications);

  if (recipientIds.length > 0) {
    thread.unreadBy = recipientIds.map((id) => toObjectId(id)).filter(Boolean);
    await thread.save();
  }

  const metadata = { ...(conversation.metadata || {}) };
  metadata.handoffRequestedAt = new Date().toISOString();
  metadata.handoffReason = reason || "user_click";
  metadata.handoffRequestedBy = user?.id || user?._id ? "user" : "guest";
  metadata.handoffSummary = preview(summaryText, 2000);
  if (normalizedGuestId) metadata.guestId = normalizedGuestId;

  conversation.status = "handoff_requested";
  conversation.chatThreadId = thread._id;
  conversation.metadata = metadata;
  await conversation.save();

  if (io) {
    io.to(`restaurant_${conversation.restaurantId}`).emit("threadUpdated", {
      threadId: String(thread._id),
      lastMessagePreview: thread.lastMessagePreview,
      lastMessageAt: thread.lastMessageAt,
    });
    recipientIds.forEach((uid) => {
      io.to(`user_${uid}`).emit("notificationCreated", {
        type: "ai_chatbot_handoff",
        threadId: String(thread._id),
        messagePreview: preview(summaryText, 140),
      });
    });
  }

  return {
    ok: true,
    conversationId: String(conversation._id),
    handoffRequested: true,
    chatThreadId: String(thread._id),
    notificationCount: notifications.length,
    message: "Nhân viên đã được thông báo. Bạn có thể tiếp tục gửi tin nhắn, nhân viên sẽ xem lịch sử trước đó.",
    alreadyRequested: false,
  };
}
