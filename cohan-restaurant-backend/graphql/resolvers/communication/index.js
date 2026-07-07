import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import {
  BrandMembership,
  ChatThread,
  Notification,
  Restaurant,
} from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import {
  hasAnyPermission,
  hasPermission,
} from "../../../src/services/auth/authorization.service.js";
import {
  getScopedRestaurantFilter,
  isSystemAdmin,
} from "../../../src/services/auth/restaurantScope.service.js";
import { emitAiChatbotStaffReplyIfLinked } from "../../../src/services/ai/restaurantChatbotRealtime.service.js";
import { setNotificationSocketServer } from "../../../src/services/notification/notificationWorkflow.service.js";

const HANDOFF_VIEW_PERMISSIONS = [
  PERMISSIONS.AI_CHATBOT_HANDOFF,
  PERMISSIONS.AI_CHATBOT_MODERATE,
];

const toId = (id) => {
  if (!id || !mongoose.isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

const roleSlug = (user) =>
  String(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || "").toLowerCase();

const isAiHandoffThread = (thread) =>
  String(thread?.kind || "").toLowerCase() === "ai_chatbot_handoff" ||
  String(thread?.subject || "").trim().toLowerCase().startsWith("ai handoff") ||
  String(thread?.messages?.[0]?.content || "").includes("[AI HANDOFF]");

const bindNotificationSocket = (ctx) => {
  if (ctx?.io) setNotificationSocketServer(ctx.io);
};

const ensureAuth = (ctx) => {
  bindNotificationSocket(ctx);
  if (!ctx?.user?.id) {
    throw new GraphQLError("Unauthorized", { extensions: { code: "UNAUTHORIZED" } });
  }
};

async function loadRestaurantBrandId(restaurantId) {
  if (!restaurantId) return null;
  const restaurant = await Restaurant.findById(restaurantId).select("brandId").lean();
  return restaurant?.brandId || null;
}

async function activeManagerIdsForRestaurant(restaurantId) {
  const brandId = await loadRestaurantBrandId(restaurantId);
  if (!brandId) return [];

  const memberships = await BrandMembership.find({
    brandId,
    role: "manager",
    status: "active",
    restaurantIds: restaurantId,
  }).select("userId").lean();
  return [...new Set(memberships.map((membership) => String(membership.userId)).filter(Boolean))];
}

const canAccessThread = async (thread, user, ctx, restaurantScopeChecked = false) => {
  const uid = String(user?.id || "");
  if (!uid || !thread) return false;

  if (isAiHandoffThread(thread)) {
    if (!(await hasAnyPermission(user, HANDOFF_VIEW_PERMISSIONS))) return false;
    if (!thread.restaurantId) return false;
    if (restaurantScopeChecked) return true;

    try {
      await requireRestaurantAccess(ctx, thread.restaurantId);
      return true;
    } catch {
      return false;
    }
  }

  if (isSystemAdmin(user)) return true;
  if ((thread.participants || []).some((p) => String(p) === uid)) return true;

  const myRole = roleSlug(user);
  if (thread.targetRole && myRole && myRole === String(thread.targetRole).toLowerCase()) {
    if (!thread.restaurantId) return true;
    if (restaurantScopeChecked) return true;
    try {
      await requireRestaurantAccess(ctx, thread.restaurantId);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

const resolveRecipientIdsByRole = async ({ thread, senderId }) => {
  const targetRole = String(thread?.targetRole || "").toLowerCase();
  if (!targetRole || !thread?.restaurantId) return [];

  const brandId = await loadRestaurantBrandId(thread.restaurantId);
  if (!brandId) return [];

  const membershipBranches = {
    management: [
      { role: { $in: ["owner", "admin"] } },
      { role: "manager", restaurantIds: thread.restaurantId },
    ],
    manager: [
      { role: { $in: ["owner", "admin"] } },
      { role: "manager", restaurantIds: thread.restaurantId },
    ],
    kitchen: [{ role: "staff", restaurantIds: thread.restaurantId }],
    cashier: [{ role: "staff", restaurantIds: thread.restaurantId }],
    staff: [{ role: "staff", restaurantIds: thread.restaurantId }],
    support: [
      { role: { $in: ["owner", "admin"] } },
      { role: { $in: ["manager", "staff"] }, restaurantIds: thread.restaurantId },
    ],
  };
  const branches = membershipBranches[targetRole];
  if (!branches) return [];

  const memberships = await BrandMembership.find({
    brandId,
    status: "active",
    $or: branches,
  }).select("userId").lean();

  return [...new Set(memberships.map((membership) => String(membership.userId)).filter(Boolean))]
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

async function requireRestaurantScopeIfProvided(ctx, restaurantId, { allowCustomerPublic = false } = {}) {
  if (!restaurantId) return null;
  const rid = toId(restaurantId);
  if (!rid) throw badInput("Invalid restaurantId");

  const isCustomer = roleSlug(ctx?.user) === "customer" || String(ctx?.user?.userType || "").toUpperCase() === "CUSTOMER";
  if (allowCustomerPublic && isCustomer) {
    const exists = await Restaurant.exists({ _id: rid });
    if (!exists) throw badInput("Invalid restaurantId");
    return rid;
  }

  await requireRestaurantAccess(ctx, rid);
  return rid;
}

const buildNotificationCondition = async (ctx, { restaurantId, unreadOnly = false } = {}) => {
  ensureAuth(ctx);
  const user = ctx.user;
  const uid = toId(user.id);
  const rid = await requireRestaurantScopeIfProvided(ctx, restaurantId);
  const userRole = roleSlug(user);
  const isCustomer = userRole === "customer" || String(user?.userType || "").toUpperCase() === "CUSTOMER";
  const cond = isCustomer
    ? { toUserId: uid }
    : { $or: [{ toUserId: uid }, { toRole: userRole }] };

  if (!isCustomer) {
    const roleCondition = cond.$or[1];
    if (rid) {
      roleCondition.restaurantId = rid;
    } else if (!isSystemAdmin(user)) {
      const scopedFilter = await getScopedRestaurantFilter(user);
      const scopedIds = await Restaurant.distinct("_id", scopedFilter);
      roleCondition.restaurantId = { $in: scopedIds };
    }
  }
  if (rid) cond.restaurantId = rid;
  if (unreadOnly) cond.readAt = null;
  cond.dismissedByUserIds = { $ne: uid };
  return cond;
};

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
    const rid = await requireRestaurantScopeIfProvided(ctx, restaurantId, { allowCustomerPublic: true });

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
    const access = await Promise.all(
      rows.map((thread) => canAccessThread(thread, user, ctx, Boolean(rid))),
    );

    return rows
      .filter((_, index) => access[index])
      .map((thread) => toThreadOutput(thread, user.id));
  },

  chatThread: async (_, { id }, ctx) => {
    ensureAuth(ctx);
    const doc = await ChatThread.findById(id).lean();
    if (!doc || !(await canAccessThread(doc, ctx.user, ctx))) return null;
    return toThreadOutput(doc, ctx.user.id);
  },

  notifications: async (_, { restaurantId, unreadOnly = false, limit = 50 }, ctx) => {
    const cond = await buildNotificationCondition(ctx, { restaurantId, unreadOnly });
    const rows = await Notification.find(cond)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit || 50), 200))
      .lean();

    return rows.map((n) => ({ id: String(n._id), ...n }));
  },

  unreadNotificationCount: async (_, { restaurantId }, ctx) => {
    const cond = await buildNotificationCondition(ctx, { restaurantId, unreadOnly: true });
    return Notification.countDocuments(cond);
  },

  myNotifications: async (_, { restaurantId, unreadOnly = false, limit = 50, skip = 0 }, ctx) => {
    const cond = await buildNotificationCondition(ctx, { restaurantId, unreadOnly });
    const rows = await Notification.find(cond)
      .sort({ createdAt: -1 })
      .skip(Math.max(Number(skip) || 0, 0))
      .limit(Math.min(Number(limit || 50), 200))
      .lean();
    return rows.map((n) => ({ id: String(n._id), ...n }));
  },

  notificationCount: async (_, { restaurantId, unreadOnly = false }, ctx) => {
    const cond = await buildNotificationCondition(ctx, { restaurantId, unreadOnly });
    return Notification.countDocuments(cond);
  },
};

const Mutation = {
  openChatThread: async (_, { input }, ctx) => {
    ensureAuth(ctx);
    const user = ctx.user;
    const senderId = toId(user.id);
    const rid = await requireRestaurantScopeIfProvided(ctx, input?.restaurantId, { allowCustomerPublic: true });

    if (!rid) throw badInput("Invalid restaurantId");

    const participantIds = [senderId, ...(input?.participantIds || []).map(toId).filter(Boolean)];
    let uniqueParticipantIds = [...new Set(participantIds.map((id) => String(id)))].map(toId);

    if (!input?.participantIds?.length && input?.channel === "support") {
      const managerIds = await activeManagerIdsForRestaurant(rid);
      if (managerIds.length) {
        uniqueParticipantIds = [...new Set([...uniqueParticipantIds.map(String), ...managerIds])].map(toId);
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
    const threadData = thread?.toObject();
    if (!thread || !(await canAccessThread(threadData, user, ctx))) {
      throw new GraphQLError("Thread not found or forbidden", {
        extensions: { code: "FORBIDDEN" },
      });
    }
    if (
      isAiHandoffThread(threadData) &&
      !(await hasPermission(user, PERMISSIONS.AI_CHATBOT_HANDOFF))
    ) {
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
    if (!thread || !(await canAccessThread(thread.toObject(), ctx.user, ctx))) return false;
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
    const cond = await buildNotificationCondition(ctx, { unreadOnly: true });
    const doc = await Notification.findOne({ _id: id, ...cond });
    if (!doc) return false;
    doc.readAt = new Date();
    await doc.save();
    return true;
  },

  markAllNotificationsRead: async (_, { restaurantId }, ctx) => {
    const cond = await buildNotificationCondition(ctx, { restaurantId, unreadOnly: true });
    await Notification.updateMany(cond, { $set: { readAt: new Date() } });
    return true;
  },

  archiveNotification: async (_, { id }, ctx) => {
    const cond = await buildNotificationCondition(ctx);
    if (!mongoose.isValidObjectId(id)) throw badInput("Invalid notification id");
    const uid = toId(ctx.user.id);
    const result = await Notification.updateOne(
      { _id: id, ...cond },
      { $set: { readAt: new Date() }, $addToSet: { dismissedByUserIds: uid } },
    );
    return result.modifiedCount > 0;
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
