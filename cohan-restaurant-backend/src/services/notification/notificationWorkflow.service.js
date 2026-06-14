import { Notification, User } from "../../../models/index.js";

const REVIEWER_TYPES = ["MANAGER", "ADMIN", "HR"];
const uniq = (arr = []) => [...new Set(arr.map(String).filter(Boolean))];

let notificationIo = null;

export function setNotificationSocketServer(io) {
  notificationIo = io || null;
}

function buildUniqueKey({ toUserId, type, sourceType, sourceId }) {
  return [String(toUserId), String(type), String(sourceType || ""), String(sourceId || "")].join(":");
}

function emitNotificationCreated(notification) {
  if (!notificationIo || !notification?.toUserId) return;
  const userId = String(notification.toUserId);
  notificationIo.to(`user_${userId}`).emit("notificationCreated", {
    id: String(notification._id || notification.id || ""),
    toUserId: userId,
    toRole: notification.toRole || null,
    restaurantId: notification.restaurantId ? String(notification.restaurantId) : null,
    type: notification.type,
    payload: notification.payload || {},
    readAt: notification.readAt || null,
    createdAt: notification.createdAt || null,
  });
}

async function reviewerIds(restaurantId) {
  if (!restaurantId) return [];
  const users = await User.find({ userType: { $in: REVIEWER_TYPES }, $or: [{ restaurantForStaff: restaurantId }, { refRestaurants: restaurantId }] }).select("_id").lean();
  return uniq(users.map((u) => u._id));
}

export async function createNotificationOnce({ toUserId, toRole = null, restaurantId = null, type, payload = {}, sourceType, sourceId }) {
  if (!toUserId || !type) return null;
  const uniqueKey = buildUniqueKey({ toUserId, type, sourceType, sourceId });
  const notification = await Notification.findOneAndUpdate(
    { $or: [{ uniqueKey }, { "payload.uniqueKey": uniqueKey }] },
    {
      $setOnInsert: {
        toUserId,
        toRole,
        restaurantId,
        type,
        uniqueKey,
        payload: { ...payload, sourceType: sourceType || null, sourceId: sourceId || null, uniqueKey },
        readAt: null,
      },
    },
    { new: true, upsert: true },
  );
  emitNotificationCreated(notification);
  return notification;
}

export async function notifyReviewers({ restaurantId, type, payload, sourceType, sourceId, actionUrl }) {
  const ids = await reviewerIds(restaurantId);
  return Promise.all(ids.map((id) => createNotificationOnce({ toUserId: id, restaurantId, type, payload: { ...payload, actionUrl }, sourceType, sourceId })));
}

export async function notifyUser({ userId, restaurantId, type, payload, sourceType, sourceId, actionUrl }) {
  return createNotificationOnce({ toUserId: userId, restaurantId, type, payload: { ...payload, actionUrl }, sourceType, sourceId });
}
