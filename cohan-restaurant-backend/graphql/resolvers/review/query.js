// src/graphql/review/review.query.js
import { GraphQLError } from "graphql";
import Review from "../../../models/review.model.js";
import { requireRestaurantAccess } from "../../guards.js";

function roleSlug(user) {
  return String(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || "").toLowerCase();
}

function isStaffLike(user) {
  const role = roleSlug(user);
  return role.includes("staff") || role.includes("manager") || role.includes("admin");
}

function isAdmin(user) {
  return roleSlug(user).includes("admin");
}

function isOwner(ctx, doc) {
  const uid = ctx?.user?.id;
  return uid && String(doc?.createdBy || doc?.userId) === String(uid);
}

function forbidden(message = "Forbidden") {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

async function requireReviewModerationAccess(ctx, review) {
  if (!isStaffLike(ctx?.user)) throw forbidden();
  await requireRestaurantAccess(ctx, review.restaurantId);
}

export default {
  reviews: async (_, { restaurantId, targetType, targetId, status, minRating, maxRating, limit = 20, skip = 0 }, ctx) => {
    const filter = {};
    const wantsNonPublished = status && status !== "published";

    if (restaurantId) filter.restaurantId = restaurantId;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;

    if (wantsNonPublished) {
      if (!isStaffLike(ctx?.user)) throw forbidden();
      if (!restaurantId && !isAdmin(ctx?.user)) throw forbidden("restaurantId is required");
      if (restaurantId) await requireRestaurantAccess(ctx, restaurantId);
      filter.status = status;
    } else {
      filter.status = "published";
    }

    if (minRating) filter.rating = { ...(filter.rating || {}), $gte: minRating };
    if (maxRating) filter.rating = { ...(filter.rating || {}), $lte: maxRating };

    const total = await Review.countDocuments(filter);
    const items = await Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean({ virtuals: true });
    return { total, items };
  },

  review: async (_, { id }, ctx) => {
    const doc = await Review.findById(id).lean({ virtuals: true });
    if (!doc) return null;
    if (doc.status === "published") return doc;
    if (isOwner(ctx, doc)) return doc;
    await requireReviewModerationAccess(ctx, doc);
    return doc;
  },

  reviewStats: async (_, { restaurantId, targetType, targetId }, ctx) => {
    const filter = {};
    if (restaurantId) filter.restaurantId = restaurantId;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;

    const staff = isStaffLike(ctx?.user);
    if (staff && restaurantId) await requireRestaurantAccess(ctx, restaurantId);
    const canAllStatuses = isAdmin(ctx?.user) || (staff && restaurantId);
    if (!canAllStatuses) filter.status = "published";

    const total = await Review.countDocuments(filter);
    const pending = canAllStatuses
      ? await Review.countDocuments({ ...filter, status: "pending" })
      : 0;

    const ratingAgg = await Review.aggregate([{ $match: filter }, { $group: { _id: null, avg: { $avg: "$rating" } } }]);
    const avgRating = ratingAgg.length > 0 ? Number(ratingAgg[0].avg.toFixed(2)) : 0;
    const breakdownAgg = await Review.aggregate([{ $match: filter }, { $group: { _id: "$rating", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdownAgg.forEach((item) => { ratingBreakdown[item._id] = item.count; });
    return { total, pending, avgRating, ratingBreakdown };
  },
};
