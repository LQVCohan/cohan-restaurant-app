import mongoose from "mongoose";
import { AI_CHATBOT_RATE_LIMIT_POLICIES, consumeAiChatbotRateLimit } from "./restaurantChatbotRateLimit.service.js";
import { AiChatConversation, AiChatMessage, BrandMembership, ChatThread, User, Restaurant } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { hasPermission } from "../auth/authorization.service.js";
import { createNotificationOnce } from "../notification/notificationWorkflow.service.js";
import { mergeWithDefaultAiChatbotSettings } from "./restaurantChatbotSettings.service.js";

const toId = (value) => mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
const cleanGuestId = (value) => String(value || "").trim().slice(0, 128).replace(/[^a-zA-Z0-9_-]/g, "");
const preview = (value, max = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
const buildHandoffActionUrl = ({ userType, restaurantId, threadId }) => {
  const query = new URLSearchParams({
    restaurantId: String(restaurantId),
    threadId: String(threadId),
  }).toString();
  return String(userType || "").toUpperCase() === "STAFF"
    ? `/staff/ai-handoff?${query}`
    : `/manager?${query}#ai-handoff`;
};
const fail = (conversationId, message) => ({
  ok: false,
  conversationId,
  handoffRequested: false,
  chatThreadId: null,
  notificationCount: 0,
  message,
  alreadyRequested: false,
});

const ownsConversation = (conversation, user, guestId) => {
  if (!conversation) return false;
  const userId = user?.id || user?._id;
  return userId
    ? String(conversation.userId || "") === String(userId)
    : Boolean(guestId) && String(conversation.guestId || "") === guestId;
};

const buildSummary = ({ conversation, guestId, reason, latestUserMessage, messages }) => {
  const lines = [
    "[AI HANDOFF]",
    `conversationId: ${conversation._id}`,
    `restaurantId: ${conversation.restaurantId}`,
  ];
  if (conversation.userId) lines.push(`userId: ${conversation.userId}`);
  if (guestId) lines.push(`guestId: ${guestId}`);
  if (reason) lines.push(`reason: ${reason}`);
  if (latestUserMessage) lines.push(`latestUserMessage: ${preview(latestUserMessage, 300)}`);
  lines.push("--- Recent AI conversation ---");
  for (const message of messages) {
    const role = message.role === "assistant" ? "Assistant" : message.role === "user" ? "User" : "System";
    lines.push(`${role}: ${preview(message.content, 400)}`);
  }
  return lines.join("\n");
};

const findRecipients = async (restaurant) => {
  const membershipScope = restaurant.brandId
    ? {
        brandId: restaurant.brandId,
        status: "active",
        $or: [{ role: { $in: ["owner", "admin"] } }, { restaurantIds: restaurant._id }],
      }
    : { status: "active", restaurantIds: restaurant._id };
  const membershipIds = await BrandMembership.distinct("userId", membershipScope);
  const directIds = [...membershipIds, restaurant.managerId].filter(Boolean);
  const scope = [
    { restaurantForStaff: restaurant._id },
    { refRestaurants: restaurant._id },
    ...(directIds.length ? [{ _id: { $in: directIds } }] : []),
  ];

  const users = await User.find({ status: "active", deletedAt: null, $or: scope })
    .select("_id userType role")
    .populate({
      path: "role",
      populate: [
        { path: "permissions" },
        { path: "parentRole", populate: { path: "permissions" } },
      ],
    })
    .lean();

  const checked = await Promise.all(users.map(async (user) =>
    (await hasPermission(user, PERMISSIONS.AI_CHATBOT_HANDOFF)) ? user : null));
  return checked.filter(Boolean);
};

export async function requestRestaurantChatbotHandoff({ input, user, io, clientIp } = {}) {
  const conversationId = String(input?.conversationId || "").trim();
  const guestId = cleanGuestId(input?.guestId);
  const restaurantId = toId(input?.restaurantId);
  const reason = String(input?.reason || "user_click").trim().slice(0, 80);
  const latestUserMessage = String(input?.latestUserMessage || "").trim().slice(0, 500);

  const rate = consumeAiChatbotRateLimit({
    policy: AI_CHATBOT_RATE_LIMIT_POLICIES.requestAiChatbotHandoff,
    keyParts: { guestId, conversationId, restaurantId: String(input?.restaurantId || ""), clientIp },
  });
  if (!rate.allowed) return fail(conversationId, rate.safeMessage);
  if (!toId(conversationId)) return fail(conversationId, "Yêu cầu không hợp lệ.");

  const conversation = await AiChatConversation.findById(conversationId);
  if (!ownsConversation(conversation, user, guestId)) {
    return fail(conversationId, "Không thể xử lý yêu cầu hỗ trợ cho hội thoại này.");
  }
  if (restaurantId && String(restaurantId) !== String(conversation.restaurantId || "")) {
    return fail(conversationId, "Không thể xử lý yêu cầu hỗ trợ cho hội thoại này.");
  }
  if (!conversation.restaurantId) {
    return fail(conversationId, "Hiện chưa xác định được nhà hàng để chuyển nhân viên hỗ trợ.");
  }

  const restaurant = await Restaurant.findById(conversation.restaurantId)
    .select("aiChatbotSettings brandId managerId")
    .lean();
  if (!restaurant) return fail(conversationId, "Không thể xác định nhà hàng để chuyển hỗ trợ.");

  const settings = mergeWithDefaultAiChatbotSettings(restaurant.aiChatbotSettings || {});
  if (!settings.handoffEnabled) return fail(conversationId, settings.handoffUnavailableMessage);
  if (conversation.status === "handoff_requested" && conversation.chatThreadId) {
    return {
      ok: true,
      conversationId,
      handoffRequested: true,
      chatThreadId: String(conversation.chatThreadId),
      notificationCount: 0,
      message: "Yêu cầu hỗ trợ đã được ghi nhận trước đó.",
      alreadyRequested: true,
    };
  }

  const recipients = await findRecipients(restaurant);
  if (!recipients.length) {
    return fail(conversationId, "Hiện chưa có nhân viên được phân quyền tiếp nhận hỗ trợ. Vui lòng liên hệ nhà hàng qua kênh khác.");
  }

  const recent = await AiChatMessage.find({ conversationId: conversation._id })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean();
  const summary = buildSummary({
    conversation,
    guestId,
    reason,
    latestUserMessage,
    messages: [...recent].reverse(),
  });
  const recipientIds = [...new Set(recipients.map(({ _id }) => String(_id)))];
  const objectIds = recipientIds.map(toId).filter(Boolean);

  let thread = conversation.chatThreadId
    ? await ChatThread.findById(conversation.chatThreadId)
    : null;
  if (!thread) {
    thread = await ChatThread.create({
      restaurantId: conversation.restaurantId,
      channel: "support",
      targetRole: null,
      participants: objectIds,
      subject: "AI handoff - Khách cần hỗ trợ",
      status: "open",
      messages: [{
        senderRole: "system",
        senderName: "AI Chatbot",
        messageType: "text",
        content: summary,
        createdAt: new Date(),
      }],
      lastMessageAt: new Date(),
      lastMessagePreview: preview(summary, 140),
      unreadBy: objectIds,
    });
  } else {
    thread.targetRole = null;
    const current = new Set((thread.participants || []).map(String));
    thread.participants = [
      ...(thread.participants || []),
      ...objectIds.filter((id) => !current.has(String(id))),
    ];
  }

  const messagePreview = preview(latestUserMessage || summary, 160);
  const notifications = await Promise.all(recipients.map((recipient) =>
    createNotificationOnce({
      toUserId: recipient._id,
      toRole: "support",
      restaurantId: conversation.restaurantId,
      type: "ai_chatbot_handoff",
      sourceType: "ai_chatbot_conversation",
      sourceId: conversation._id,
      io,
      payload: {
        title: "Khách hàng cần hỗ trợ",
        message: latestUserMessage ? `Khách nhắn: ${messagePreview}` : "Có hội thoại được trợ lý AI chuyển giao.",
        actionUrl: buildHandoffActionUrl({
          userType: recipient.userType,
          restaurantId: conversation.restaurantId,
          threadId: thread._id,
        }),
        threadId: String(thread._id),
        conversationId,
        guestId: guestId || null,
        restaurantId: String(conversation.restaurantId),
        source: "ai_chatbot",
        messagePreview,
      },
    })));

  thread.unreadBy = objectIds;
  await thread.save();

  conversation.status = "handoff_requested";
  conversation.chatThreadId = thread._id;
  conversation.metadata = {
    ...(conversation.metadata || {}),
    handoffRequestedAt: new Date().toISOString(),
    handoffReason: reason,
    handoffRequestedBy: user?.id || user?._id ? "user" : "guest",
    handoffSummary: preview(summary, 2000),
    ...(guestId ? { guestId } : {}),
  };
  await conversation.save();

  io?.to(`restaurant_${conversation.restaurantId}`).emit("threadUpdated", {
    threadId: String(thread._id),
    lastMessagePreview: thread.lastMessagePreview,
    lastMessageAt: thread.lastMessageAt,
  });

  return {
    ok: true,
    conversationId,
    handoffRequested: true,
    chatThreadId: String(thread._id),
    notificationCount: notifications.filter(Boolean).length,
    message: "Nhân viên đã được thông báo. Bạn có thể tiếp tục gửi tin nhắn, nhân viên sẽ xem lịch sử trước đó.",
    alreadyRequested: false,
  };
}
