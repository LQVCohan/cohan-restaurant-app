import mongoose from "mongoose";
import {
  AI_CHATBOT_RATE_LIMIT_POLICIES,
  consumeAiChatbotRateLimit,
} from "./restaurantChatbotRateLimit.service.js";
import {
  AiChatConversation,
  AiChatMessage,
  BrandMembership,
  ChatThread,
  User,
  Restaurant,
} from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { hasPermission } from "../auth/authorization.service.js";
import { createNotificationOnce } from "../notification/notificationWorkflow.service.js";
import { mergeWithDefaultAiChatbotSettings } from "./restaurantChatbotSettings.service.js";

const toId = (value) =>
  mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
const cleanGuestId = (value) =>
  String(value || "")
    .trim()
    .slice(0, 128)
    .replace(/[^a-zA-Z0-9_-]/g, "");
const preview = (value, max = 240) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
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

const isAiHandoffThread = (thread) =>
  String(thread?.kind || "").toLowerCase() === "ai_chatbot_handoff" ||
  String(thread?.subject || "")
    .trim()
    .toLowerCase()
    .startsWith("ai handoff") ||
  String(thread?.messages?.[0]?.content || "").includes("[AI HANDOFF]");

const isActiveLinkedThread = (thread, conversation) =>
  Boolean(
    thread &&
      String(thread.status || "open").toLowerCase() === "open" &&
      String(thread.restaurantId || "") ===
        String(conversation?.restaurantId || "") &&
      isAiHandoffThread(thread),
  );

const buildSummary = ({
  conversation,
  guestId,
  reason,
  latestUserMessage,
  messages,
}) => {
  const lines = [
    "[AI HANDOFF]",
    `conversationId: ${conversation._id}`,
    `restaurantId: ${conversation.restaurantId}`,
  ];
  if (conversation.userId) lines.push(`userId: ${conversation.userId}`);
  if (guestId) lines.push(`guestId: ${guestId}`);
  if (reason) lines.push(`reason: ${reason}`);
  if (latestUserMessage) {
    lines.push(`latestUserMessage: ${preview(latestUserMessage, 300)}`);
  }
  lines.push("--- Recent AI conversation ---");
  for (const message of messages) {
    const role =
      message.role === "assistant"
        ? "Assistant"
        : message.role === "user"
          ? "User"
          : "System";
    lines.push(`${role}: ${preview(message.content, 400)}`);
  }
  return lines.join("\n");
};

const findRecipients = async (restaurant) => {
  if (!restaurant?.brandId) return [];

  const membershipIds = await BrandMembership.distinct("userId", {
    brandId: restaurant.brandId,
    status: "active",
    $or: [
      { role: { $in: ["owner", "admin"] } },
      {
        role: { $in: ["manager", "staff"] },
        restaurantIds: restaurant._id,
      },
    ],
  });
  if (!membershipIds.length) return [];

  const users = await User.find({
    _id: { $in: membershipIds },
    status: "active",
    deletedAt: null,
  })
    .select("_id userType role")
    .populate({
      path: "role",
      populate: [
        { path: "permissions" },
        { path: "parentRole", populate: { path: "permissions" } },
      ],
    })
    .lean();

  const checked = await Promise.all(
    users.map(async (candidate) =>
      (await hasPermission(candidate, PERMISSIONS.AI_CHATBOT_HANDOFF))
        ? candidate
        : null,
    ),
  );
  return checked.filter(Boolean);
};

async function findConversationThread(conversation) {
  if (conversation?.chatThreadId) {
    const linked = await ChatThread.findById(conversation.chatThreadId);
    if (linked) return linked;
  }
  return ChatThread.findOne({ sourceConversationId: conversation?._id });
}

async function getOrCreateHandoffThread({
  conversation,
  objectIds,
  summary,
  messagePreview,
}) {
  let thread = await findConversationThread(conversation);
  if (thread) {
    if (!isActiveLinkedThread(thread, conversation)) return null;
    const updated = await ChatThread.findOneAndUpdate(
      {
        _id: thread._id,
        restaurantId: conversation.restaurantId,
        status: "open",
      },
      {
        $set: {
          sourceConversationId: conversation._id,
          kind: "ai_chatbot_handoff",
          targetRole: null,
        },
        $addToSet: {
          participants: { $each: objectIds },
          unreadBy: { $each: objectIds },
        },
      },
      { new: true },
    );
    return updated || null;
  }

  const now = new Date();
  try {
    thread = await ChatThread.findOneAndUpdate(
      { sourceConversationId: conversation._id },
      {
        $setOnInsert: {
          restaurantId: conversation.restaurantId,
          sourceConversationId: conversation._id,
          channel: "support",
          kind: "ai_chatbot_handoff",
          targetRole: null,
          participants: objectIds,
          subject: "AI handoff - Khách cần hỗ trợ",
          status: "open",
          messages: [
            {
              senderRole: "system",
              senderName: "AI Chatbot",
              messageType: "text",
              content: summary,
              createdAt: now,
            },
          ],
          lastMessageAt: now,
          lastMessagePreview: messagePreview,
          unreadBy: objectIds,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error?.code !== 11000) throw error;
    thread = await ChatThread.findOne({
      sourceConversationId: conversation._id,
    });
  }

  if (!isActiveLinkedThread(thread, conversation)) return null;
  return ChatThread.findOneAndUpdate(
    { _id: thread._id, status: "open" },
    {
      $addToSet: {
        participants: { $each: objectIds },
        unreadBy: { $each: objectIds },
      },
    },
    { new: true },
  );
}

export async function requestRestaurantChatbotHandoff({
  input,
  user,
  io,
  clientIp,
} = {}) {
  const conversationId = String(input?.conversationId || "").trim();
  const guestId = cleanGuestId(input?.guestId);
  const restaurantId = toId(input?.restaurantId);
  const reason = String(input?.reason || "user_click").trim().slice(0, 80);
  const latestUserMessage = String(input?.latestUserMessage || "")
    .trim()
    .slice(0, 500);

  const rate = consumeAiChatbotRateLimit({
    policy: AI_CHATBOT_RATE_LIMIT_POLICIES.requestAiChatbotHandoff,
    keyParts: {
      guestId,
      conversationId,
      restaurantId: String(input?.restaurantId || ""),
      clientIp,
    },
  });
  if (!rate.allowed) return fail(conversationId, rate.safeMessage);
  if (!toId(conversationId)) {
    return fail(conversationId, "Yêu cầu không hợp lệ.");
  }

  const conversation = await AiChatConversation.findById(conversationId);
  if (!ownsConversation(conversation, user, guestId)) {
    return fail(
      conversationId,
      "Không thể xử lý yêu cầu hỗ trợ cho hội thoại này.",
    );
  }
  if (
    restaurantId &&
    String(restaurantId) !== String(conversation.restaurantId || "")
  ) {
    return fail(
      conversationId,
      "Không thể xử lý yêu cầu hỗ trợ cho hội thoại này.",
    );
  }
  if (!conversation.restaurantId) {
    return fail(
      conversationId,
      "Hiện chưa xác định được nhà hàng để chuyển nhân viên hỗ trợ.",
    );
  }
  if (String(conversation.status || "open") === "closed") {
    return fail(
      conversationId,
      "Phiên hỗ trợ trước đã kết thúc. Vui lòng gửi tin nhắn mới để bắt đầu phiên hỗ trợ khác.",
    );
  }

  const restaurant = await Restaurant.findById(conversation.restaurantId)
    .select("aiChatbotSettings brandId")
    .lean();
  if (!restaurant) {
    return fail(
      conversationId,
      "Không thể xác định nhà hàng để chuyển hỗ trợ.",
    );
  }

  const settings = mergeWithDefaultAiChatbotSettings(
    restaurant.aiChatbotSettings || {},
  );
  if (!settings.handoffEnabled) {
    return fail(conversationId, settings.handoffUnavailableMessage);
  }

  if (conversation.status === "handoff_requested") {
    const activeThread = await findConversationThread(conversation);
    if (isActiveLinkedThread(activeThread, conversation)) {
      return {
        ok: true,
        conversationId,
        handoffRequested: true,
        chatThreadId: String(activeThread._id),
        notificationCount: 0,
        message: "Yêu cầu hỗ trợ đã được ghi nhận trước đó.",
        alreadyRequested: true,
      };
    }

    if (String(activeThread?.status || "").toLowerCase() === "closed") {
      await AiChatConversation.updateOne(
        { _id: conversation._id, status: "handoff_requested" },
        { $set: { status: "closed" } },
      );
      return fail(
        conversationId,
        "Phiên hỗ trợ trước đã kết thúc. Vui lòng gửi tin nhắn mới để bắt đầu phiên hỗ trợ khác.",
      );
    }

    await AiChatConversation.updateOne(
      { _id: conversation._id, status: "handoff_requested" },
      { $set: { status: "open", chatThreadId: null } },
    );
    conversation.status = "open";
    conversation.chatThreadId = null;
  }

  if (String(conversation.status || "open") !== "open") {
    return fail(
      conversationId,
      "Hội thoại hiện không thể chuyển cho nhân viên hỗ trợ.",
    );
  }

  const recipients = await findRecipients(restaurant);
  if (!recipients.length) {
    return fail(
      conversationId,
      "Hiện chưa có nhân viên được phân quyền tiếp nhận hỗ trợ. Vui lòng liên hệ nhà hàng qua kênh khác.",
    );
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
  const recipientIds = [
    ...new Set(recipients.map(({ _id }) => String(_id))),
  ];
  const objectIds = recipientIds.map(toId).filter(Boolean);
  const messagePreview = preview(latestUserMessage || summary, 160);

  const thread = await getOrCreateHandoffThread({
    conversation,
    objectIds,
    summary,
    messagePreview,
  });
  if (!thread) {
    return fail(
      conversationId,
      "Phiên hỗ trợ trước không còn hoạt động. Vui lòng gửi tin nhắn mới để tạo yêu cầu khác.",
    );
  }

  const requestedAt = new Date().toISOString();
  const linkedConversation = await AiChatConversation.findOneAndUpdate(
    { _id: conversation._id, status: "open" },
    {
      $set: {
        status: "handoff_requested",
        chatThreadId: thread._id,
        metadata: {
          ...(conversation.metadata || {}),
          handoffRequestedAt: requestedAt,
          handoffReason: reason,
          handoffRequestedBy:
            user?.id || user?._id ? "user" : "guest",
          handoffSummary: preview(summary, 2000),
          ...(guestId ? { guestId } : {}),
        },
      },
    },
    { new: true },
  );

  if (!linkedConversation) {
    const latest = await AiChatConversation.findById(conversation._id).lean();
    if (
      latest?.status === "handoff_requested" &&
      String(latest.chatThreadId || "") === String(thread._id)
    ) {
      return {
        ok: true,
        conversationId,
        handoffRequested: true,
        chatThreadId: String(thread._id),
        notificationCount: 0,
        message: "Yêu cầu hỗ trợ đã được ghi nhận trước đó.",
        alreadyRequested: true,
      };
    }
    return fail(
      conversationId,
      "Trạng thái hội thoại đã thay đổi. Vui lòng tải lại trước khi gửi yêu cầu hỗ trợ.",
    );
  }

  const notifications = await Promise.all(
    recipients.map((recipient) =>
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
          message: latestUserMessage
            ? `Khách nhắn: ${messagePreview}`
            : "Có hội thoại được trợ lý AI chuyển giao.",
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
      }),
    ),
  );

  try {
    io?.to(`restaurant_${conversation.restaurantId}`).emit("threadUpdated", {
      threadId: String(thread._id),
      lastMessagePreview: thread.lastMessagePreview,
      lastMessageAt: thread.lastMessageAt,
    });
  } catch {
    // Realtime delivery is best effort; persisted notification remains authoritative.
  }

  return {
    ok: true,
    conversationId,
    handoffRequested: true,
    chatThreadId: String(thread._id),
    notificationCount: notifications.filter(Boolean).length,
    message:
      "Nhân viên đã được thông báo. Bạn có thể tiếp tục gửi tin nhắn, nhân viên sẽ xem lịch sử trước đó.",
    alreadyRequested: false,
  };
}
