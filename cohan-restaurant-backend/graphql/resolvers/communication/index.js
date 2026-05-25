import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  ChatThread,
  Notification,
  Restaurant,
  User,
} from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import { emitAiChatbotStaffReplyIfLinked } from "../../../src/services/ai/restaurantChatbotRealtime.service.js";

const toId = (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

const roleSlug = (user) =>
  String(user?.roleName || user?.role?.slug || user?.role?.name || "").toLowerCase();

const ensureAuth = (ctx) => {
  if (!ctx?.user?.id) {
    throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
  }
};

const getUserRestaurantIds = (user) => {
  const ids = [];
  if (user?.restaurantForStaff) ids.push(String(user.restaurantForStaff));
  if (Array.isArray(user?.refRestaurants)) {
    user.refRestaurants.forEach((id) => ids.push(String(id)));
  }
  return [...new Set(ids.filter(Boolean))];
};

const canAccessThread = (thread, user) => {
  const uid = String(user?.id || "");
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

const resolveRecipientIdsByRole = async ({ thread, senderId }) => {
  const role = String(thread?.targetRole || "").toUpperCase();
  if (!role || !thread?.restaurantId) return [];

  const roleMap = {
    management: ["MANAGER", "ADMIN"],
    manager: ["MANAGER", "ADMIN"],
    kitchen: ["STAFF"],
    cashier: ["STAFF"],
    staff: ["STAFF"],
    support: ["STAFF", "MANAGER", "ADMIN"],
  };

  const userTypes = roleMap[role.toLowerCase()] || [role];

  const users = await User.find({
    userType: { $in: userTypes },
    $or: [
      { restaurantForStaff: thread.restaurantId },
      { refRestaurants: thread.restaurantId },
    ],
  })
    .select("_id")
    .lean();

  return users
    .map((u) => String(u._id))
    .filter((id) => id !== String(senderId));
};

const toThreadOutput = (thread, userId) => {
  const uid = String(userId || "");
  return {
    id: String(thread._id),
    ...thread,
    participants: (thread.participants || []).map((x) => String(x)),
    unreadCount: (thread.unreadBy || []).some((x) => String(x) === uid) ? 1 : 0,
  };
};


function badInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

async function requireRestaurantScopeIfProvided(ctx, restaurantId) {
  if (!restaurantId) return null;
  const rid = toId(restaurantId);
  if (!rid) throw badInput("Invalid restaurantId");
  await requireRestaurantAccess(ctx, rid);
  return rid;
}

const normalizeChatThreadStatus = (status) => {
  if (status == null || status === "") return "open";
  const normalized = String(status).trim().toLowerCase();
  if (!["open", "closed"].includes(normalized)) {
    throw badInput("Invalid chat thread status. Allowed values: open, closed");
  }
  return normalized;
};

const Query = {
  chatThreads: async (_, { restaurantId, channel, limit = 30, status }, ctx) => {
    ensureAuth(ctx);
    const user = ctx.user;
    const uid = toId(user.id);
    const rid = await requireRestaurantScopeIfProvided(ctx, restaurantId);

    const cond = { status: normalizeChatThreadStatus(status) };
    if (rid) cond.restaurantId = rid;
    if (channel) cond.channel = channel;

    if (!rid) {
      cond.$or = [{ participants: uid }, { targetRole: roleSlug(user) }];
    }

    const rows = await ChatThread.find(cond)
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .limit(Math.min(Number(limit || 30), 100))
      .lean();

    return rows.filter((t) => canAccessThread(t, user)).map((t) => toThreadOutput(t, user.id));
  },

  chatThread: async (_, { id }, ctx) => {
    ensureAuth(ctx);
    const doc = await ChatThread.findById(id).lean();
    if (!doc || !canAccessThread(doc, ctx.user)) return null;
    return toThreadOutput(doc, ctx.user.id);
  },

  notifications: async (_, { restaurantId, unreadOnly = false, limit = 50 }, ctx) => {
    ensureAuth(ctx);
    const user = ctx.user;
    const rid = await requireRestaurantScopeIfProvided(ctx, restaurantId);

    const cond = {
      $or: [{ toUserId: toId(user.id) }, { toRole: roleSlug(user) }],
    };

    if (rid) cond.restaurantId = rid;
    if (unreadOnly) cond.readAt = null;

    const rows = await Notification.find(cond)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit || 50), 200))
      .lean();

    return rows.map((n) => ({ id: String(n._id), ...n }));
  },

  unreadNotificationCount: async (_, { restaurantId }, ctx) => {
    ensureAuth(ctx);
    const rid = await requireRestaurantScopeIfProvided(ctx, restaurantId);
    const cond = {
      readAt: null,
      $or: [{ toUserId: toId(ctx.user.id) }, { toRole: roleSlug(ctx.user) }],
    };
    if (rid) cond.restaurantId = rid;
    return Notification.countDocuments(cond);
  },
};

const Mutation = {
  openChatThread: async (_, { input }, ctx) => {
    ensureAuth(ctx);
    const user = ctx.user;
    const senderId = toId(user.id);
    const rid = await requireRestaurantScopeIfProvided(ctx, input?.restaurantId);

    if (!rid) throw badInput("Invalid restaurantId");

    const participantIds = [senderId, ...(input?.participantIds || []).map(toId).filter(Boolean)];
    let uniqueParticipantIds = [...new Set(participantIds.map((id) => String(id)))].map(toId);

    if (!input?.participantIds?.length && input?.channel === "support") {
      const restaurant = await Restaurant.findById(rid).select("managerId").lean();
      if (restaurant?.managerId) {
        uniqueParticipantIds = [...new Set([...uniqueParticipantIds.map(String), String(restaurant.managerId)])].map(toId);
      }
    }

    const roleTarget = input?.targetRole ? String(input.targetRole).toLowerCase() : null;

    const existing = await ChatThread.findOne({
      restaurantId: rid,
      channel: input?.channel || "support",
      ...(roleTarget ? { targetRole: roleTarget } : {}),
      ...(uniqueParticipantIds.length
        ? { participants: { $all: uniqueParticipantIds, $size: uniqueParticipantIds.length } }
        : {}),
      status: "open",
    });

    if (existing) {
      return toThreadOutput(existing.toObject(), user.id);
    }

    const created = await ChatThread.create({
      restaurantId: rid,
      channel: input?.channel || "support",
      participants: uniqueParticipantIds,
      subject: input?.subject || "",
      targetRole: roleTarget,
      messages: [],
      unreadBy: [],
    });

    return toThreadOutput(created.toObject(), user.id);
  },

  sendChatMessage: async (_, { input }, ctx) => {
    ensureAuth(ctx);
    const user = ctx.user;
    const senderId = String(user.id);
    const content = String(input?.content || "").trim();
    if (!content) {
      throw new GraphQLError("Tin nhắn không được để trống", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const thread = await ChatThread.findById(input.threadId);
    if (!thread || !canAccessThread(thread.toObject(), user)) {
      throw new GraphQLError("Thread not found or forbidden", {
        extensions: { code: "FORBIDDEN" },
      });
    }
    if (String(thread.status || "").toLowerCase() === "closed") {
      throw new GraphQLError("Phiên hỗ trợ đã được đóng.", {
        extensions: { code: "CHAT_THREAD_CLOSED" },
      });
    }

    const message = {
      senderId,
      senderRole: roleSlug(user),
      senderName: user.fullName || user.email || "Unknown",
      messageType: "text",
      content,
      createdAt: new Date(),
    };

    thread.messages.push(message);
    const messageIndex = thread.messages.length - 1;
    const realtimeMessage = thread.messages[messageIndex] || message;
    thread.lastMessageAt = message.createdAt;
    thread.lastMessagePreview = content.slice(0, 140);

    const directRecipientIds = (thread.participants || [])
      .map((id) => String(id))
      .filter((id) => id !== senderId);
    const roleRecipientIds = await resolveRecipientIdsByRole({ thread, senderId });
    const recipientIds = [...new Set([...directRecipientIds, ...roleRecipientIds])];

    thread.unreadBy = recipientIds.map((id) => toId(id)).filter(Boolean);
    await thread.save();

    if (recipientIds.length > 0) {
      await Notification.insertMany(
        recipientIds.map((toUserId) => ({
          toUserId,
          toRole: thread.targetRole || null,
          restaurantId: thread.restaurantId,
          type: "chat_message",
          payload: {
            threadId: String(thread._id),
            channel: thread.channel,
            senderId,
            senderName: message.senderName,
            messagePreview: thread.lastMessagePreview,
          },
        }))
      );
    }

    if (ctx?.io) {
      const payload = {
        threadId: String(thread._id),
        restaurantId: String(thread.restaurantId || ""),
        message,
      };
      ctx.io.to(`chat_thread_${thread._id}`).emit("chatMessageCreated", payload);
      ctx.io.to(`restaurant_${thread.restaurantId}`).emit("threadUpdated", {
        threadId: String(thread._id),
        lastMessagePreview: thread.lastMessagePreview,
        lastMessageAt: thread.lastMessageAt,
      });
      recipientIds.forEach((uid) => {
        ctx.io.to(`user_${uid}`).emit("notificationCreated", {
          type: "chat_message",
          threadId: String(thread._id),
          messagePreview: thread.lastMessagePreview,
        });
      });
      await emitAiChatbotStaffReplyIfLinked({
        io: ctx.io,
        chatThreadId: thread._id,
        message: realtimeMessage,
        fallbackIndex: messageIndex,
      });
    }

    return toThreadOutput(thread.toObject(), user.id);
  },

  markChatThreadRead: async (_, { threadId }, ctx) => {
    ensureAuth(ctx);
    const uid = toId(ctx.user.id);
    const thread = await ChatThread.findById(threadId);
    if (!thread || !canAccessThread(thread.toObject(), ctx.user)) return false;
    thread.unreadBy = (thread.unreadBy || []).filter((x) => String(x) !== String(uid));
    await thread.save();

    await Notification.updateMany(
      {
        toUserId: uid,
        type: "chat_message",
        "payload.threadId": String(threadId),
        readAt: null,
      },
      { $set: { readAt: new Date() } }
    );

    return true;
  },

  markNotificationRead: async (_, { id }, ctx) => {
    ensureAuth(ctx);
    const uid = toId(ctx.user.id);
    const doc = await Notification.findOne({ _id: id, toUserId: uid });
    if (!doc) return false;
    doc.readAt = new Date();
    await doc.save();
    return true;
  },

  markAllNotificationsRead: async (_, { restaurantId }, ctx) => {
    ensureAuth(ctx);
    const uid = toId(ctx.user.id);
    const rid = await requireRestaurantScopeIfProvided(ctx, restaurantId);
    const cond = { toUserId: uid, readAt: null };
    if (rid) cond.restaurantId = rid;
    await Notification.updateMany(cond, { $set: { readAt: new Date() } });
    return true;
  },
};

const ChatThreadType = {
  messages: (parent, { limit = 50 }) => {
    const rows = Array.isArray(parent?.messages) ? parent.messages : [];
    return rows.slice(-Math.min(Number(limit || 50), 200));
  },
};

export default {
  Query,
  Mutation,
  ChatThread: ChatThreadType,
};
