import mongoose from "mongoose";
import { AiChatConversation, ChatThread } from "../../../models/index.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission } from "../auth/authorization.service.js";

const CLOSURE_MESSAGE = "Phiên hỗ trợ đã được đánh dấu là đã xử lý.";
const GUEST_NOTICE = "Nhân viên đã kết thúc phiên hỗ trợ.";

const toObjectId = (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

const roleSlug = (user) => String(user?.roleName || user?.role?.slug || user?.role?.name || "").toLowerCase();

const getUserRestaurantIds = (user) => {
  const ids = [];
  if (user?.restaurantForStaff) ids.push(String(user.restaurantForStaff));
  return [...new Set(ids.filter(Boolean))];
};

const canAccessThread = (thread, user) => {
  const uid = String(user?.id || user?._id || "");
  if (!uid || !thread) return false;
  if (["admin"].includes(roleSlug(user))) return true;
  if ((thread.participants || []).some((p) => String(p) === uid)) return true;

  const myRole = roleSlug(user);
  if (thread.targetRole && myRole && myRole === String(thread.targetRole).toLowerCase()) {
    const myRestaurantIds = getUserRestaurantIds(user);
    return !thread.restaurantId || myRestaurantIds.includes(String(thread.restaurantId));
  }
  return false;
};

const sanitizeNote = (value) => String(value || "").replace(/\s+/g, " ").trim().slice(0, 300);
const preview = (text, max = 140) => String(text || "").replace(/\s+/g, " ").trim().slice(0, max);

export async function resolveRestaurantChatbotHandoff({ input, user, ctx, io } = {}) {
  if (!(user?.id || user?._id)) {
    const err = new Error("Unauthorized");
    err.code = "UNAUTHORIZED";
    throw err;
  }

  const conversationId = String(input?.conversationId || "").trim();
  const chatThreadId = String(input?.chatThreadId || "").trim();
  const conversationObjectId = toObjectId(conversationId);
  const threadObjectId = toObjectId(chatThreadId);

  if (!conversationObjectId && !threadObjectId) {
    return { ok: false, conversationId: null, chatThreadId: null, status: null, alreadyClosed: false, message: "Yêu cầu không hợp lệ." };
  }

  let conversation = null;
  if (conversationObjectId) conversation = await AiChatConversation.findById(conversationObjectId);
  if (!conversation && threadObjectId) conversation = await AiChatConversation.findOne({ chatThreadId: threadObjectId });

  if (!conversation) {
    return { ok: false, conversationId: null, chatThreadId: null, status: null, alreadyClosed: false, message: "Không thể xử lý yêu cầu." };
  }

  await requireRestaurantPermission(
    ctx || { user },
    conversation.restaurantId,
    PERMISSIONS.AI_CHATBOT_HANDOFF,
  );

  const isClosed = conversation.status === "closed";
  const isHandoffRequested = conversation.status === "handoff_requested";
  if (!isClosed && !isHandoffRequested) {
    return { ok: false, conversationId: null, chatThreadId: null, status: null, alreadyClosed: false, message: "Không thể xử lý yêu cầu." };
  }

  let thread = null;
  if (conversation.chatThreadId) thread = await ChatThread.findById(conversation.chatThreadId);

  if (isHandoffRequested && !conversation.chatThreadId) {
    return { ok: false, conversationId: null, chatThreadId: null, status: null, alreadyClosed: false, message: "Không thể xử lý yêu cầu." };
  }
  if (isHandoffRequested && conversation.chatThreadId && !thread) {
    return { ok: false, conversationId: null, chatThreadId: null, status: null, alreadyClosed: false, message: "Không thể xử lý yêu cầu." };
  }

  if (thread && !canAccessThread(thread.toObject ? thread.toObject() : thread, user)) {
    const err = new Error("Forbidden");
    err.code = "FORBIDDEN";
    throw err;
  }

  const note = sanitizeNote(input?.resolutionNote);
  const convoClosed = conversation.status === "closed";
  const threadClosed = !thread || thread.status === "closed";

  if (convoClosed && threadClosed) {
    return {
      ok: true,
      conversationId: String(conversation._id),
      chatThreadId: conversation.chatThreadId ? String(conversation.chatThreadId) : null,
      status: "closed",
      alreadyClosed: true,
      message: "Phiên hỗ trợ đã ở trạng thái đã xử lý.",
    };
  }

  const now = new Date();
  conversation.status = "closed";
  conversation.metadata = {
    ...(conversation.metadata || {}),
    handoffResolvedAt: now.toISOString(),
    handoffResolvedBy: String(user.id || user._id),
    ...(note ? { handoffResolutionNote: note } : {}),
  };
  await conversation.save();

  let closureMessage = null;
  if (thread && thread.status !== "closed") {
    const content = note ? `${CLOSURE_MESSAGE}\nGhi chú: ${note}` : CLOSURE_MESSAGE;
    closureMessage = {
      senderRole: "system",
      senderName: "Hệ thống",
      messageType: "text",
      content,
      createdAt: now,
    };
    thread.messages.push(closureMessage);
    thread.status = "closed";
    thread.lastMessageAt = now;
    thread.lastMessagePreview = preview(content, 140);
    await thread.save();
  }

  if (io) {
    try {
      io.to(`ai_conv_${conversation._id}`).emit("aiChatbotHandoffResolved", {
        conversationId: String(conversation._id),
        status: "closed",
        message: GUEST_NOTICE,
      });

      if (thread) {
        if (closureMessage) {
          io.to(`chat_thread_${thread._id}`).emit("chatMessageCreated", {
            threadId: String(thread._id),
            restaurantId: String(thread.restaurantId || ""),
            message: closureMessage,
          });
        }
        io.to(`restaurant_${thread.restaurantId}`).emit("threadUpdated", {
          threadId: String(thread._id),
          lastMessagePreview: thread.lastMessagePreview,
          lastMessageAt: thread.lastMessageAt,
          status: "closed",
        });
      }
    } catch {
      // best effort realtime
    }
  }

  return {
    ok: true,
    conversationId: String(conversation._id),
    chatThreadId: conversation.chatThreadId ? String(conversation.chatThreadId) : null,
    status: "closed",
    alreadyClosed: false,
    message: "Đã đánh dấu phiên hỗ trợ là đã xử lý.",
  };
}