import { Notification, User } from "../../../models/index.js";
const REVIEWER_TYPES = ["MANAGER", "ADMIN", "HR"];
const uniq = (arr = []) => [...new Set(arr.map(String).filter(Boolean))];

async function reviewerIds(restaurantId) {
  if (!restaurantId) return [];
  const users = await User.find({ userType: { $in: REVIEWER_TYPES }, $or: [{ restaurantForStaff: restaurantId }, { refRestaurants: restaurantId }] }).select("_id").lean();
  return uniq(users.map((u) => u._id));
}

export async function createNotificationOnce({ toUserId, toRole = null, restaurantId = null, type, payload = {}, sourceType, sourceId }) {
  if (!toUserId || !type) return null;
  const uniqueKey = [String(toUserId), String(type), String(sourceType || ""), String(sourceId || "")].join(":");
  return Notification.findOneAndUpdate({ "payload.uniqueKey": uniqueKey }, { $setOnInsert: { toUserId, toRole, restaurantId, type, payload: { ...payload, sourceType: sourceType || null, sourceId: sourceId || null, uniqueKey }, readAt: null } }, { new: true, upsert: true });
}

export async function notifyReviewers({ restaurantId, type, payload, sourceType, sourceId, actionUrl }) {
  const ids = await reviewerIds(restaurantId);
  return Promise.all(ids.map((id) => createNotificationOnce({ toUserId: id, restaurantId, type, payload: { ...payload, actionUrl }, sourceType, sourceId })));
}

export async function notifyUser({ userId, restaurantId, type, payload, sourceType, sourceId, actionUrl }) {
  return createNotificationOnce({ toUserId: userId, restaurantId, type, payload: { ...payload, actionUrl }, sourceType, sourceId });
}
