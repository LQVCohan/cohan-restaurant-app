import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { MenuItem, Order, PaymentTransaction, Reservation, Restaurant, User } from "../../models/index.js";

export const REVIEW_STATUSES = Object.freeze(["pending", "published", "hidden", "reported", "rejected"]);
export const REVIEW_REACTION_TYPES = Object.freeze(["like", "love", "care", "haha", "wow", "sad", "angry"]);
export const REVIEW_REPORT_REASONS = Object.freeze(["spam", "abuse", "offensive", "fake", "privacy", "other"]);

const MAX_IMAGES = 6;
const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 32;
const MIN_CONTENT_LENGTH = 10;
const MAX_CONTENT_LENGTH = 2000;
const MAX_TITLE_LENGTH = 120;
const REVIEW_RELIABILITY_SCORE_BY_SOURCE = Object.freeze({
  order: 95,
  payment: 85,
  reservation: 80,
  manual: 70,
  none: 35,
});

export const REVIEW_SERVICE_TARGETS = Object.freeze([
  { id: "65f100000000000000000101", slug: "service_quality", name: "Chất lượng phục vụ" },
  { id: "65f100000000000000000102", slug: "serving_speed", name: "Tốc độ phục vụ" },
  { id: "65f100000000000000000103", slug: "cleanliness", name: "Vệ sinh không gian" },
  { id: "65f100000000000000000104", slug: "payment", name: "Thanh toán" },
  { id: "65f100000000000000000105", slug: "booking", name: "Đặt bàn" },
  { id: "65f100000000000000000106", slug: "delivery", name: "Giao hàng" },
]);

export function resolveServiceReviewTarget(targetId) {
  const key = String(targetId || "").trim().toLowerCase();
  return REVIEW_SERVICE_TARGETS.find((target) => target.id === key || target.slug === key) || null;
}

export function normalizeReviewTargetForPersistence({ targetId, targetName, serviceTarget }) {
  return {
    targetId: serviceTarget?.id || targetId,
    targetName: serviceTarget?.name || String(targetName || "").trim(),
  };
}

export function badUserInput(message) {
  return new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
}

export function forbidden(message = "Forbidden") {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

export function unauthenticated(message = "Login required") {
  return new GraphQLError(message, { extensions: { code: "UNAUTHENTICATED" } });
}

export function normalizeReviewInput(input = {}) {
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw badUserInput("Rating phải từ 1 đến 5.");
  }

  const content = String(input.content || "").trim();
  if (content.length < MIN_CONTENT_LENGTH || content.length > MAX_CONTENT_LENGTH) {
    throw badUserInput(`Nội dung đánh giá phải từ ${MIN_CONTENT_LENGTH} đến ${MAX_CONTENT_LENGTH} ký tự.`);
  }

  const title = String(input.title || "").trim();
  if (title.length > MAX_TITLE_LENGTH) throw badUserInput(`Tiêu đề tối đa ${MAX_TITLE_LENGTH} ký tự.`);

  const images = Array.isArray(input.images) ? input.images.map((x) => String(x || "").trim()).filter(Boolean) : [];
  if (images.length > MAX_IMAGES) throw badUserInput(`Tối đa ${MAX_IMAGES} ảnh cho một đánh giá.`);
  const validPath = /^(https?:\/\/|\/uploads\/|\/assets\/|data:image\/)/i;
  if (images.some((url) => url.length > 600 || !validPath.test(url))) {
    throw badUserInput("Ảnh đánh giá phải là URL hoặc đường dẫn upload hợp lệ.");
  }

  const tagSet = new Set();
  (Array.isArray(input.tags) ? input.tags : []).forEach((tag) => {
    const value = String(tag || "").trim().toLowerCase();
    if (value && value.length <= MAX_TAG_LENGTH) tagSet.add(value);
  });
  const tags = Array.from(tagSet).slice(0, MAX_TAGS);

  return { rating, content, title, images, tags, location: String(input.location || "").trim() };
}

export function deriveCustomerIdentity(ctx) {
  const user = ctx?.user;
  if (!user?.id && !user?._id) throw unauthenticated();
  const userId = user.id || user._id;
  const name = user.fullName || user.name || user.displayName || user.username || user.email || "Khách hàng";
  const avatar = user.avatarUrl || user.avatar || user.photoURL || user.profileImage || "";
  return { customerId: userId, customerName: String(name).trim() || "Khách hàng", customerAvatar: avatar };
}

export async function normalizeReviewStaff({ staffId, restaurantId }) {
  if (!staffId) return { staffId: null, staffName: "" };
  const staff = await User.findOne({
    _id: staffId,
    userType: { $in: ["STAFF", "staff"] },
    deletedAt: null,
    restaurantForStaff: restaurantId,
  }).select("_id fullName name email").lean();
  if (!staff) throw badUserInput("Nhân viên không hợp lệ cho nhà hàng này.");
  return { staffId: staff._id, staffName: staff.fullName || staff.name || staff.email || "" };
}

export async function validateReviewTarget({ targetType, targetId, restaurantId }) {
  if (!["restaurant", "food", "service"].includes(targetType)) throw badUserInput("Loại đối tượng đánh giá không hợp lệ.");
  if (!mongoose.isValidObjectId(restaurantId)) throw badUserInput("ID nhà hàng không hợp lệ.");
  if (targetType === "service") {
    const serviceTarget = resolveServiceReviewTarget(targetId);
    if (!serviceTarget) throw badUserInput("Dịch vụ đánh giá không hợp lệ.");
    const restaurantExists = await Restaurant.exists({ _id: restaurantId });
    if (!restaurantExists) throw badUserInput("Nhà hàng không tồn tại.");
    return serviceTarget;
  }
  if (!mongoose.isValidObjectId(targetId)) throw badUserInput("ID đánh giá không hợp lệ.");

  if (targetType === "restaurant") {
    if (String(targetId) !== String(restaurantId)) throw badUserInput("targetId nhà hàng phải trùng restaurantId.");
    const exists = await Restaurant.exists({ _id: restaurantId });
    if (!exists) throw badUserInput("Nhà hàng không tồn tại.");
    return;
  }

  if (targetType === "food") {
    const exists = await MenuItem.exists({ _id: targetId, restaurantId });
    if (!exists) throw badUserInput("Món ăn không thuộc nhà hàng này.");
    return;
  }

  return null;
}

export async function resolveVerifiedReview({ userId, restaurantId, targetType, targetId }) {
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const orderMatch = {
    userId,
    restaurantId,
    createdAt: { $gte: since },
    $or: [
      { currentStatus: { $in: ["served", "completed"] } },
      { orderPaymentStatus: "paid" },
      { publicStatus: { $in: ["SERVED", "PAID"] } },
    ],
  };
  if (targetType === "food") orderMatch["items.dishId"] = targetId;
  const order = await Order.findOne(orderMatch).sort({ updatedAt: -1, createdAt: -1 }).select("_id createdAt updatedAt closedAt paidAt currentStatus orderPaymentStatus items").lean();
  if (order) {
    return {
      verifiedPurchase: true,
      verifiedSource: "order",
      verifiedSourceId: order._id,
      visitedAt: order.closedAt || order.paidAt || order.updatedAt || order.createdAt,
      orderCompletedAt: order.closedAt || order.paidAt || order.updatedAt || order.createdAt,
    };
  }

  const payment = await PaymentTransaction.findOne({ restaurantId, userId, status: "SUCCESS", paidAt: { $gte: since } }).sort({ paidAt: -1 }).select("_id paidAt").lean();
  if (payment && targetType !== "food") {
    return { verifiedPurchase: true, verifiedSource: "payment", verifiedSourceId: payment._id, visitedAt: payment.paidAt, orderCompletedAt: payment.paidAt };
  }

  const reservation = await Reservation.findOne({ restaurantId, userId, timeTo: { $gte: since }, status: { $in: ["confirmed", "seated", "completed"] } }).sort({ timeTo: -1 }).select("_id timeTo status").lean();
  if (reservation && targetType !== "food") {
    return { verifiedPurchase: true, verifiedSource: "reservation", verifiedSourceId: reservation._id, visitedAt: reservation.timeTo, orderCompletedAt: reservation.timeTo };
  }

  return { verifiedPurchase: false, verifiedSource: "none", verifiedSourceId: null, visitedAt: null, orderCompletedAt: null };
}

export function calculateReviewReliability(verified = {}) {
  const source = String(verified.verifiedSource || "none").toLowerCase();
  const reliabilityScore = REVIEW_RELIABILITY_SCORE_BY_SOURCE[source] ?? REVIEW_RELIABILITY_SCORE_BY_SOURCE.none;
  const reliabilityLevel = reliabilityScore >= 80 ? "high" : reliabilityScore >= 60 ? "medium" : "low";
  const reliabilitySignals = [
    verified.verifiedPurchase ? "verified_experience" : "unverified_experience",
    `source:${source}`,
  ];
  return { reliabilityScore, reliabilityLevel, reliabilitySignals };
}

export function buildReactionIncPayload({ inc = {}, dec = {}, likeCounter = true }) {
  const payload = {};
  for (const [key, value] of Object.entries(inc)) payload[`reactions.${key}`] = (payload[`reactions.${key}`] || 0) + value;
  for (const [key, value] of Object.entries(dec)) payload[`reactions.${key}`] = (payload[`reactions.${key}`] || 0) - value;
  if (likeCounter) payload.likesCount = Number(inc.like || 0) - Number(dec.like || 0);
  if (payload.likesCount === 0) delete payload.likesCount;
  return payload;
}

export function clampReactionSummary(doc) {
  const patch = {};
  for (const key of REVIEW_REACTION_TYPES) {
    if (Number(doc?.reactions?.[key] || 0) < 0) patch[`reactions.${key}`] = 0;
  }
  if (Number(doc?.likesCount || 0) < 0) patch.likesCount = 0;
  if (Number(doc?.helpfulCount || 0) < 0) patch.helpfulCount = 0;
  if (Number(doc?.reportsCount || 0) < 0) patch.reportsCount = 0;
  return patch;
}

export function analyzeReviewText(title = "", content = "") {
  const text = `${title} ${content}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const negative = ["cham", "lau", "nguoi", "do", "thai do", "ban", "sai mon", "tinh nham", "that vong", "te", "kem"];
  const positive = ["ngon", "nhanh", "sach", "than thien", "hai long", "tot", "tuyet", "de thuong"];
  const score = positive.filter((kw) => text.includes(kw)).length - negative.filter((kw) => text.includes(kw)).length;
  const topicMap = {
    service_speed: ["cham", "lau", "nhanh"],
    food_quality: ["ngon", "nguoi", "do", "sai mon"],
    staff_attitude: ["thai do", "than thien", "de thuong"],
    cleanliness: ["sach", "ban"],
    payment: ["tinh nham", "hoa don", "thanh toan"],
    price: ["dat", "re", "gia"],
    ambience: ["khong gian", "on", "dep"],
  };
  return {
    sentiment: score > 0 ? "positive" : score < 0 ? "negative" : "neutral",
    topicTags: Object.entries(topicMap).filter(([, kws]) => kws.some((kw) => text.includes(kw))).map(([key]) => key),
  };
}
