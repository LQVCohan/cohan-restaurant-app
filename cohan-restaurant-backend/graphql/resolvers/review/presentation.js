import mongoose from "mongoose";

import Review from "../../../models/review.model.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const PUBLIC_OPERATION_NAMES = new Set([
  "GetRestaurantReviews",
  "GetRestaurantReviewStats",
  "GetRestaurantReviewStatsForHeader",
  "FoodReviewSummaryV2",
]);

const PUBLIC_OPERATION_PREFIXES = [
  "FoodReview",
  "CustomerFoodReview",
  "PublicRestaurantReview",
];

function operationName(info) {
  return String(info?.operation?.name?.value || "");
}

export function isPublicReviewOperation(info) {
  const name = operationName(info);
  return (
    PUBLIC_OPERATION_NAMES.has(name) ||
    PUBLIC_OPERATION_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

function roleSlug(user) {
  return String(
    user?.roleName ||
      user?.role?.slug ||
      user?.role?.name ||
      user?.userType ||
      "",
  ).toLowerCase();
}

function isAdmin(user) {
  return roleSlug(user).includes("admin");
}

async function canManageRestaurant(ctx, restaurantId) {
  if (!ctx?.user) return false;
  if (isAdmin(ctx.user)) return true;
  if (!restaurantId) return false;

  try {
    await requireRestaurantPermission(ctx, restaurantId, "review.read");
    return true;
  } catch {
    return false;
  }
}

function toObjectId(value) {
  if (!value) return value;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return mongoose.isValidObjectId(value)
    ? new mongoose.Types.ObjectId(String(value))
    : value;
}

function buildReviewFilter({ restaurantId, targetType, targetId } = {}) {
  const filter = {};
  if (restaurantId) filter.restaurantId = toObjectId(restaurantId);
  if (targetType) filter.targetType = targetType;
  if (targetId) filter.targetId = toObjectId(targetId);
  return filter;
}

export async function resolvePresentedReviews(
  baseResolver,
  root,
  args,
  ctx,
  info,
) {
  if (!isPublicReviewOperation(info)) {
    return baseResolver(root, args, ctx, info);
  }

  // Customer-facing pages must remain public even when the current account also
  // has manager permissions. Removing the privileged user from this resolver
  // context preserves the existing public visibility rules in query.js.
  return baseResolver(root, args, { ...ctx, user: null }, info);
}

export async function resolvePresentedReviewStats(root, args, ctx, info) {
  const publicOnly = isPublicReviewOperation(info);
  const canReadAllStatuses = publicOnly
    ? false
    : await canManageRestaurant(ctx, args?.restaurantId);

  const filter = buildReviewFilter(args);
  if (!canReadAllStatuses) {
    filter.status = { $in: ["published", "reported"] };
  }

  const [aggregation = {}] = await Review.aggregate([
    { $match: filter },
    {
      $set: {
        __normalizedRating: {
          $convert: {
            input: "$rating",
            to: "double",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    {
      $facet: {
        totals: [{ $count: "count" }],
        ratingSummary: [
          {
            $match: {
              __normalizedRating: { $gte: 1, $lte: 5 },
            },
          },
          {
            $group: {
              _id: null,
              average: { $avg: "$__normalizedRating" },
            },
          },
        ],
        ratingBreakdown: [
          {
            $match: {
              __normalizedRating: { $gte: 1, $lte: 5 },
            },
          },
          {
            $group: {
              _id: { $round: ["$__normalizedRating", 0] },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  const total = Number(aggregation?.totals?.[0]?.count || 0);
  const rawAverage = Number(aggregation?.ratingSummary?.[0]?.average || 0);
  const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const row of aggregation?.ratingBreakdown || []) {
    const rating = Number(row?._id);
    if (rating >= 1 && rating <= 5) {
      ratingBreakdown[rating] = Number(row?.count || 0);
    }
  }

  const pending = canReadAllStatuses
    ? await Review.countDocuments({
        ...buildReviewFilter(args),
        status: "pending",
      })
    : 0;

  return {
    total,
    pending,
    avgRating: Number(rawAverage.toFixed(2)),
    ratingBreakdown,
  };
}

function dateCandidate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value.$date) return dateCandidate(value.$date);

  if (typeof value === "number") {
    return new Date(value < 10_000_000_000 ? value * 1000 : value);
  }

  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{10,13}$/.test(text)) {
    const numeric = Number(text);
    return new Date(text.length === 10 ? numeric * 1000 : numeric);
  }

  return new Date(text);
}

export function toGraphqlDate(value, fallbackId = null) {
  let date = dateCandidate(value);

  if (!date || Number.isNaN(date.getTime())) {
    try {
      const objectId =
        fallbackId instanceof mongoose.Types.ObjectId
          ? fallbackId
          : mongoose.isValidObjectId(fallbackId)
            ? new mongoose.Types.ObjectId(String(fallbackId))
            : null;
      date = objectId?.getTimestamp?.() || null;
    } catch {
      date = null;
    }
  }

  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

export function hasGroundedVerification(review, now = new Date()) {
  if (!review?.verifiedPurchase) return false;

  // A badge is only shown when there is transactional evidence. A reservation
  // alone, especially a merely confirmed/future reservation, is not proof that
  // the customer actually used or paid for the service.
  const source = String(review?.verifiedSource || "none").toLowerCase();
  if (!["order", "payment"].includes(source)) return false;
  if (!review?.verifiedSourceId) return false;

  const evidenceDate = dateCandidate(
    review?.orderCompletedAt || review?.visitedAt || review?.updatedAt,
  );
  if (!evidenceDate || Number.isNaN(evidenceDate.getTime())) return false;

  return evidenceDate.getTime() <= now.getTime() + 5 * 60 * 1000;
}

export function presentedVerifiedSource(review) {
  return hasGroundedVerification(review)
    ? String(review?.verifiedSource || "none")
    : "none";
}
