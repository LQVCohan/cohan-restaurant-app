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

const sanitizeNote = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
const preview = (text, max = 140) =>
  String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const isAiHandoffThread = (thread) =>
  String(thread?.kind || "").toLowerCase() === "ai_chatbot_handoff" ||
  String(thread?.subject || "")
    .trim()
    .toLowerCase()
    .startsWith("ai handoff") ||
  String(thread?.messages?.[0]?.content || "").includes("[AI HANDOFF]");

const invalidResult = (message = "Không thể xử lý yêu cầu.") => ({
  ok: false,
  conversationId: null,
  chatThreadId: null,
  status: null,
  alreadyClosed: false,
  message,
});

const withSession = (query, session) => {
  if (session && query && typeof query.session === "function") {
    return query.session(session);
  }
  return query;
};

async function loadConversation({ conversationObjectId, threadObjectId, session }) {
  if (conversationObjectId) {
    const conversation = await withSession(
      AiChatConversation.findById(conversationObjectId),
      session,
    );
    if (conversation) return conversation;
  }
  if (!threadObjectId) return null;
  return withSession(
    AiChatConversation.findOne({ chatThreadId: threadObjectId }),
    session,
  );
}

async function loadThread(threadId, session) {
  if (!threadId) return null;
  return withSession(ChatThread.findById(threadId), session);
}

export async function resolveRestaurantChatbotHandoff({
  input,
  user,
  ctx,
  io,
} = {}) {
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
    return invalidResult("Yêu cầu không hợp lệ.");
  }

  const conversation = await loadConversation({
    conversationObjectId,
    threadObjectId,
    session: null,
  });
  if (!conversation) return invalidResult();

  if (
    threadObjectId &&
    String(conversation.chatThreadId || "") !== String(threadObjectId)
  ) {
    return invalidResult(
      "Hội thoại và phiên hỗ trợ không khớp. Vui lòng tải lại dữ liệu.",
    );
  }

  await requireRestaurantPermission(
    ctx || { user },
    conversation.restaurantId,
    PERMISSIONS.AI_CHATBOT_HANDOFF,
  );

  const isClosed = conversation.status === "closed";
  const isHandoffRequested = conversation.status === "handoff_requested";
  if (!isClosed && !isHandoffRequested) return invalidResult();
  if (isHandoffRequested && !conversation.chatThreadId) {
    return invalidResult();
  }

  const thread = await loadThread(conversation.chatThreadId, null);
  if (isHandoffRequested && !thread) return invalidResult();
  if (
    thread &&
    (String(thread.restaurantId || "") !==
      String(conversation.restaurantId || "") ||
      !isAiHandoffThread(thread))
  ) {
    return invalidResult(
      "Phiên hỗ trợ không thuộc hội thoại hoặc nhà hàng hiện tại.",
    );
  }

  const convoClosed = conversation.status === "closed";
  const threadClosed = !thread || thread.status === "closed";
  if (convoClosed && threadClosed) {
    return {
      ok: true,
      conversationId: String(conversation._id),
      chatThreadId: conversation.chatThreadId
        ? String(conversation.chatThreadId)
        : null,
      status: "closed",
      alreadyClosed: true,
      message: "Phiên hỗ trợ đã ở trạng thái đã xử lý.",
    };
  }

  const note = sanitizeNote(input?.resolutionNote);
  const now = new Date();
  const content = note
    ? `${CLOSURE_MESSAGE}\nGhi chú: ${note}`
    : CLOSURE_MESSAGE;
  const closureMessage = {
    senderRole: "system",
    senderName: "Hệ thống",
    messageType: "text",
    content,
    createdAt: now,
  };

  const session = await mongoose.startSession();
  let threadWasClosed = threadClosed;
  try {
    await session.withTransaction(async () => {
      const currentConversation = await loadConversation({
        conversationObjectId: conversation._id,
        threadObjectId: null,
        session,
      });
      if (
        !currentConversation ||
        !["handoff_requested", "closed"].includes(
          String(currentConversation.status || ""),
        ) ||
        String(currentConversation.chatThreadId || "") !==
          String(conversation.chatThreadId || "")
      ) {
        const err = new Error("HANDOFF_STATE_CHANGED");
        err.code = "HANDOFF_STATE_CHANGED";
        throw err;
      }

      if (thread) {
        const threadUpdate = await ChatThread.updateOne(
          {
            _id: thread._id,
            restaurantId: conversation.restaurantId,
            status: { $ne: "closed" },
          },
          {
            $set: {
              status: "closed",
              lastMessageAt: now,
              lastMessagePreview: preview(content, 140),
            },
            $push: { messages: closureMessage },
          },
          { session },
        );
        threadWasClosed = Number(threadUpdate?.modifiedCount || 0) === 0;
      }

      await AiChatConversation.updateOne(
        {
          _id: conversation._id,
          status: { $in: ["handoff_requested", "closed"] },
          chatThreadId: conversation.chatThreadId || null,
        },
        {
          $set: {
            status: "closed",
            metadata: {
              ...(currentConversation.metadata || {}),
              handoffResolvedAt: now.toISOString(),
              handoffResolvedBy: String(user.id || user._id),
              ...(note ? { handoffResolutionNote: note } : {}),
            },
          },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  if (io) {
    try {
      io.to(`ai_conv_${conversation._id}`).emit("aiChatbotHandoffResolved", {
        conversationId: String(conversation._id),
        status: "closed",
        message: GUEST_NOTICE,
      });

      if (thread) {
        if (!threadWasClosed) {
          io.to(`chat_thread_${thread._id}`).emit("chatMessageCreated", {
            threadId: String(thread._id),
            restaurantId: String(thread.restaurantId || ""),
            message: closureMessage,
          });
        }
        io.to(`restaurant_${thread.restaurantId}`).emit("threadUpdated", {
          threadId: String(thread._id),
          lastMessagePreview: preview(content, 140),
          lastMessageAt: now,
          status: "closed",
        });
      }
    } catch {
      // Persisted state is authoritative; realtime delivery is best effort.
    }
  }

  return {
    ok: true,
    conversationId: String(conversation._id),
    chatThreadId: conversation.chatThreadId
      ? String(conversation.chatThreadId)
      : null,
    status: "closed",
    alreadyClosed: convoClosed && threadWasClosed,
    message: "Đã đánh dấu phiên hỗ trợ là đã xử lý.",
  };
}
