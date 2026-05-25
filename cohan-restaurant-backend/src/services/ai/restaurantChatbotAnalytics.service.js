import mongoose from "mongoose";
import { AiChatConversation, AiChatMessage } from "../../../models/index.js";
import { AI_CHATBOT_RATE_LIMIT_POLICIES } from "./restaurantChatbotRateLimit.service.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { requireRestaurantPermission, requirePermission } from "../auth/authorization.service.js";

const ALLOWED_ROLES = new Set(["admin", "manager", "staff", "hr", "accountant", "supervisor"]);

const toSafeDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseRange = ({ from, to } = {}) => {
  const now = new Date();
  const parsedTo = toSafeDate(to) || now;
  const parsedFrom = toSafeDate(from) || new Date(parsedTo.getTime() - 7 * 24 * 60 * 60 * 1000);
  return parsedFrom <= parsedTo ? { from: parsedFrom, to: parsedTo } : { from: parsedTo, to: parsedFrom };
};

const roleSlug = (user) => String(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || "").toLowerCase();

const normalizeRestaurantId = (restaurantId) => {
  if (!restaurantId) return null;
  if (!mongoose.isValidObjectId(restaurantId)) return null;
  return new mongoose.Types.ObjectId(restaurantId);
};

const safeDiv = (a, b) => (b > 0 ? a / b : 0);

const toRateLimitStatus = () =>
  Object.values(AI_CHATBOT_RATE_LIMIT_POLICIES).map((policy) => ({
    action: String(policy?.action || ""),
    max: Number(policy?.max || 0),
    windowMs: Number(policy?.windowMs || 0),
  }));

async function enforceAnalyticsAccess({ ctx, restaurantId }) {
  const role = roleSlug(ctx?.user);
  if (!ctx?.user?.id && !ctx?.user?._id) {
    const err = new Error("UNAUTHENTICATED");
    err.code = "UNAUTHENTICATED";
    throw err;
  }
  if (!ALLOWED_ROLES.has(role)) {
    const err = new Error("FORBIDDEN");
    err.code = "FORBIDDEN";
    throw err;
  }

  if (role === "admin") {
    if (restaurantId) await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.REPORT_READ);
    else await requirePermission(ctx, PERMISSIONS.REPORT_READ);
    return;
  }

  if (!restaurantId) {
    const err = new Error("BAD_USER_INPUT: restaurantId is required");
    err.code = "BAD_USER_INPUT";
    throw err;
  }

  await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.REPORT_READ);
}

export async function getRestaurantChatbotAnalytics({ input, ctx } = {}) {
  const restaurantObjectId = normalizeRestaurantId(input?.restaurantId);
  const restaurantId = restaurantObjectId ? String(restaurantObjectId) : null;
  await enforceAnalyticsAccess({ ctx, restaurantId });

  const { from, to } = parseRange(input);
  const dateFilter = { $gte: from, $lte: to };

  const convoFilter = { createdAt: dateFilter };
  const msgFilter = { createdAt: dateFilter };
  if (restaurantObjectId) {
    convoFilter.restaurantId = restaurantObjectId;
    msgFilter.restaurantId = restaurantObjectId;
  }

  const [
    totalConversations,
    totalMessages,
    openConversations,
    handoffRequested,
    resolvedHandoffs,
    fallbackResponses,
    lowConfidenceResponses,
    topIntentsAgg,
    messagesByRoleAgg,
    resolutionPairs,
  ] = await Promise.all([
    AiChatConversation.countDocuments(convoFilter),
    AiChatMessage.countDocuments(msgFilter),
    AiChatConversation.countDocuments({ ...convoFilter, status: "open" }),
    AiChatConversation.countDocuments({ ...convoFilter, status: "handoff_requested" }),
    AiChatConversation.countDocuments({
      ...convoFilter,
      status: "closed",
      $or: [
        { chatThreadId: { $exists: true, $ne: null } },
        { "metadata.handoffResolvedAt": { $exists: true, $ne: null } },
        { "metadata.handoffRequestedAt": { $exists: true, $ne: null } },
      ],
    }),
    AiChatMessage.countDocuments({ ...msgFilter, isFallback: true }),
    AiChatMessage.countDocuments({ ...msgFilter, confidence: { $lt: 0.6 } }),
    AiChatConversation.aggregate([
      { $match: convoFilter },
      { $project: { intent: { $ifNull: ["$lastIntent", "unknown"] } } },
      { $group: { _id: "$intent", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    AiChatMessage.aggregate([
      { $match: msgFilter },
      { $project: { role: { $ifNull: ["$role", "unknown"] } } },
      { $group: { _id: "$role", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    AiChatConversation.find(
      {
        ...convoFilter,
        "metadata.handoffRequestedAt": { $exists: true, $ne: null },
        "metadata.handoffResolvedAt": { $exists: true, $ne: null },
      },
      { metadata: 1 }
    ).lean(),
  ]);

  const resolutionMinutes = resolutionPairs
    .map((c) => {
      const requestedAt = toSafeDate(c?.metadata?.handoffRequestedAt);
      const resolvedAt = toSafeDate(c?.metadata?.handoffResolvedAt);
      if (!requestedAt || !resolvedAt || resolvedAt < requestedAt) return null;
      return (resolvedAt.getTime() - requestedAt.getTime()) / 60000;
    })
    .filter((v) => Number.isFinite(v));

  const avgResolution =
    resolutionMinutes.length > 0
      ? resolutionMinutes.reduce((s, n) => s + n, 0) / resolutionMinutes.length
      : null;

  return {
    totalConversations,
    totalMessages,
    openConversations,
    handoffRequested,
    resolvedHandoffs,
    fallbackResponses,
    lowConfidenceResponses,
    handoffConversionRate: safeDiv(handoffRequested, totalConversations),
    averageMessagesPerConversation: safeDiv(totalMessages, totalConversations),
    averageHandoffResolutionMinutes: avgResolution,
    topIntents: topIntentsAgg.map((item) => ({ intent: String(item._id || "unknown"), count: Number(item.count || 0) })),
    messagesByRole: messagesByRoleAgg.map((item) => ({ role: String(item._id || "unknown"), count: Number(item.count || 0) })),
    rateLimitStatus: toRateLimitStatus(),
  };
}
