import { GraphQLError } from "graphql";
import Review from "../../../models/review.model.js";
import { EventLog, ReviewComment, ReviewReport } from "../../../models/index.js";
import { generateReviewInsight } from "../../../src/services/reviewInsight.service.js";
import {
  requirePermission,
  requireRestaurantPermission,
} from "../../../src/services/auth/authorization.service.js";

function roleSlug(user) {
  return String(
    user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || "",
  ).toLowerCase();
}

function isAdmin(user) {
  return roleSlug(user).includes("admin");
}

function isOwner(ctx, doc) {
  const uid = ctx?.user?.id || ctx?.user?._id;
  return (
    uid &&
    String(doc?.customerId || doc?.createdBy || doc?.userId) === String(uid)
  );
}

function forbidden(message = "Forbidden") {
  return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });
}

async function requireReviewModerationAccess(ctx, review) {
  await requireRestaurantPermission(ctx, review.restaurantId, "review.read");
}

async function canManageRestaurant(
  ctx,
  restaurantId,
  permission = "review.read",
) {
  if (!ctx?.user) return false;
  if (isAdmin(ctx.user)) return true;
  try {
    await requireRestaurantPermission(ctx, restaurantId, permission);
    return true;
  } catch {
    return false;
  }
}

function dateFilter(dateFrom, dateTo) {
  const createdAt = {};
  if (dateFrom) createdAt.$gte = new Date(dateFrom);
  if (dateTo) createdAt.$lte = new Date(dateTo);
  return Object.keys(createdAt).length ? { createdAt } : {};
}

async function attachFirstOfficialReplies(items = []) {
  const ids = items.map((item) => item?._id || item?.id).filter(Boolean);
  if (!ids.length) return items;

  const replies = await ReviewComment.find({
    reviewId: { $in: ids },
    officialReply: true,
    status: "published",
  })
    .sort({ createdAt: 1 })
    .lean({ virtuals: true });

  const firstByReview = new Map();
  replies.forEach((reply) => {
    const key = String(reply.reviewId);
    if (!firstByReview.has(key)) firstByReview.set(key, reply);
  });

  return items.map((item) => ({
    ...item,
    firstOfficialReply:
      firstByReview.get(String(item._id || item.id)) || null,
  }));
}

export default {
  reviews: async (
    _,
    {
      restaurantId,
      targetType,
      targetId,
      status,
      minRating,
      maxRating,
      limit = 20,
      skip = 0,
    },
    ctx,
  ) => {
    const filter = {};
    if (restaurantId) filter.restaurantId = restaurantId;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;

    const canModerate = restaurantId
      ? await canManageRestaurant(ctx, restaurantId, "review.read")
      : isAdmin(ctx?.user);

    if (status) {
      if (!["published", "reported"].includes(status) && !canModerate) {
        throw forbidden();
      }

      if (!canModerate && status === "published") {
        filter.status = { $in: ["published", "reported"] };
      } else if (canModerate && status === "reported") {
        // A review can remain public while one or more reports are pending.
        // The manager queue must include both states without changing public visibility.
        filter.$or = [
          { status: "reported" },
          { status: "published", reportsCount: { $gt: 0 } },
        ];
      } else {
        filter.status = status;
      }
    } else if (!canModerate) {
      const uid = ctx?.user?.id || ctx?.user?._id;
      filter.$or = [
        { status: { $in: ["published", "reported"] } },
        ...(uid ? [{ customerId: uid }] : []),
      ];
    }

    if (minRating) {
      filter.rating = { ...(filter.rating || {}), $gte: minRating };
    }
    if (maxRating) {
      filter.rating = { ...(filter.rating || {}), $lte: maxRating };
    }

    const safeLimit = Math.min(Number(limit) || 20, 100);
    const total = await Review.countDocuments(filter);
    const items = await Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean({ virtuals: true });

    return { total, items: await attachFirstOfficialReplies(items) };
  },

  review: async (_, { id }, ctx) => {
    const doc = await Review.findById(id).lean({ virtuals: true });
    if (!doc) return null;
    const withReply = (await attachFirstOfficialReplies([doc]))[0];
    if (["published", "reported"].includes(doc.status) || isOwner(ctx, doc)) {
      return withReply;
    }
    await requireReviewModerationAccess(ctx, doc);
    return withReply;
  },

  reviewStats: async (_, { restaurantId, targetType, targetId }, ctx) => {
    const filter = {};
    if (restaurantId) filter.restaurantId = restaurantId;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;

    const canAllStatuses = restaurantId
      ? await canManageRestaurant(ctx, restaurantId, "review.read")
      : isAdmin(ctx?.user);
    if (!canAllStatuses) filter.status = { $in: ["published", "reported"] };

    const total = await Review.countDocuments(filter);
    const pending = canAllStatuses
      ? await Review.countDocuments({ ...filter, status: "pending" })
      : 0;
    const ratingAgg = await Review.aggregate([
      { $match: filter },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]);
    const avgRating = ratingAgg.length
      ? Number(ratingAgg[0].avg.toFixed(2))
      : 0;
    const breakdownAgg = await Review.aggregate([
      { $match: filter },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdownAgg.forEach((item) => {
      ratingBreakdown[item._id] = item.count;
    });
    return { total, pending, avgRating, ratingBreakdown };
  },

  reviewReports: async (
    _,
    { restaurantId, status, reason, limit = 20, skip = 0 },
    ctx,
  ) => {
    if (restaurantId) {
      await requireRestaurantPermission(ctx, restaurantId, "review.report.read");
    } else {
      if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");
      await requirePermission(ctx, "review.report.read");
    }

    const filter = {};
    if (restaurantId) filter.restaurantId = restaurantId;
    if (status) filter.status = status;
    if (reason) filter.reason = reason;
    const safeLimit = Math.min(Number(limit) || 20, 100);
    const total = await ReviewReport.countDocuments(filter);
    const items = await ReviewReport.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean({ virtuals: true });
    return { total, items };
  },

  reviewReportStats: async (_, { restaurantId }, ctx) => {
    if (restaurantId) {
      await requireRestaurantPermission(ctx, restaurantId, "review.report.read");
    } else {
      if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");
      await requirePermission(ctx, "review.report.read");
    }

    const match = restaurantId ? { restaurantId } : {};
    const rows = await ReviewReport.aggregate([
      { $match: match },
      {
        $group: {
          _id: { status: "$status", reason: "$reason" },
          count: { $sum: 1 },
        },
      },
    ]);
    const byStatus = {};
    const byReason = {};
    let total = 0;
    rows.forEach((row) => {
      total += row.count;
      byStatus[row._id.status] =
        (byStatus[row._id.status] || 0) + row.count;
      byReason[row._id.reason] =
        (byReason[row._id.reason] || 0) + row.count;
    });
    return {
      total,
      pending: byStatus.pending || 0,
      resolved: byStatus.resolved || 0,
      rejected: byStatus.rejected || 0,
      byReason,
    };
  },

  reviewAnalytics: async (
    _,
    { restaurantId, targetType, dateFrom, dateTo },
    ctx,
  ) => {
    if (restaurantId) {
      await requireRestaurantPermission(
        ctx,
        restaurantId,
        "review.analytics.read",
      );
    } else {
      if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");
      await requirePermission(ctx, "review.analytics.read");
    }

    const match = { ...dateFilter(dateFrom, dateTo) };
    if (restaurantId) match.restaurantId = restaurantId;
    if (targetType) match.targetType = targetType;

    const [summary] = await Review.aggregate([
      { $match: match },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                pendingCount: {
                  $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
                },
                publishedCount: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "published"] }, 1, 0],
                  },
                },
                hiddenCount: {
                  $sum: { $cond: [{ $eq: ["$status", "hidden"] }, 1, 0] },
                },
                rejectedCount: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "rejected"] }, 1, 0],
                  },
                },
                reportedCount: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $eq: ["$status", "reported"] },
                          { $gt: [{ $ifNull: ["$reportsCount", 0] }, 0] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                highRisk: {
                  $sum: {
                    $cond: [
                      {
                        $or: [
                          { $gte: ["$reportsCount", 3] },
                          { $lte: ["$rating", 1] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          publishedStats: [
            { $match: { status: { $in: ["published", "reported"] } } },
            {
              $group: {
                _id: null,
                publishedVisibleCount: { $sum: 1 },
                avgRating: { $avg: "$rating" },
                negativeCount: {
                  $sum: { $cond: [{ $lte: ["$rating", 2] }, 1, 0] },
                },
                verifiedCount: {
                  $sum: { $cond: ["$verifiedPurchase", 1, 0] },
                },
              },
            },
          ],
          ratingBreakdownRows: [
            { $match: { status: { $in: ["published", "reported"] } } },
            { $group: { _id: "$rating", count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
          ],
          ratingTrend: [
            { $match: { status: { $in: ["published", "reported"] } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                total: { $sum: 1 },
                avgRating: { $avg: "$rating" },
              },
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                date: "$_id",
                total: 1,
                avgRating: { $round: ["$avgRating", 2] },
              },
            },
          ],
          topTags: [
            {
              $project: {
                tag: {
                  $setUnion: [
                    { $ifNull: ["$tags", []] },
                    { $ifNull: ["$topicTags", []] },
                  ],
                },
              },
            },
            { $unwind: "$tag" },
            { $group: { _id: "$tag", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, name: "$_id", count: 1 } },
          ],
          topStaffMentioned: [
            { $match: { staffId: { $ne: null } } },
            {
              $group: {
                _id: "$staffId",
                name: { $first: "$staffName" },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { _id: 0, id: "$_id", name: 1, count: 1 } },
          ],
          lowRatedTargets: [
            { $match: { rating: { $lte: 2 } } },
            {
              $group: {
                _id: "$targetId",
                name: { $first: "$targetName" },
                targetType: { $first: "$targetType" },
                count: { $sum: 1 },
                avgRating: { $avg: "$rating" },
              },
            },
            { $sort: { count: -1, avgRating: 1 } },
            { $limit: 10 },
            {
              $project: {
                _id: 0,
                id: "$_id",
                name: 1,
                targetType: 1,
                count: 1,
                avgRating: { $round: ["$avgRating", 2] },
              },
            },
          ],
          reportBreakdown: [
            { $match: { reportsCount: { $gt: 0 } } },
            { $group: { _id: "$status", count: { $sum: "$reportsCount" } } },
            { $project: { _id: 0, name: "$_id", count: 1 } },
          ],
          negativeUnrepliedReviews: [
            {
              $match: {
                status: { $in: ["published", "reported"] },
                rating: { $lte: 2 },
                firstOfficialReplyAt: null,
              },
            },
            { $count: "count" },
          ],
        },
      },
    ]);

    const totals = summary?.totals?.[0] || {};
    const publishedStats = summary?.publishedStats?.[0] || {};
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (summary?.ratingBreakdownRows || []).forEach((row) => {
      ratingBreakdown[row._id] = row.count;
    });

    const reviewIds = await Review.find(match)
      .select(
        "_id createdAt status rating title content tags topicTags firstOfficialReplyAt",
      )
      .limit(5000)
      .lean();
    const official = reviewIds.length
      ? await ReviewComment.aggregate([
          {
            $match: {
              reviewId: { $in: reviewIds.map((review) => review._id) },
              officialReply: true,
              status: "published",
            },
          },
          { $group: { _id: "$reviewId", first: { $min: "$createdAt" } } },
        ])
      : [];
    const createdById = new Map(
      reviewIds.map((review) => [String(review._id), review.createdAt]),
    );
    const replyMinutes = official
      .map((row) => {
        const createdAt = createdById.get(String(row._id));
        return createdAt
          ? (new Date(row.first) - new Date(createdAt)) / 60000
          : null;
      })
      .filter((value) => Number.isFinite(value) && value >= 0);
    const visibleCount = Number(publishedStats.publishedVisibleCount || 0);
    const reportedCount = Number(totals.reportedCount || 0);

    const analytics = {
      totalReviews: Number(totals.totalReviews || 0),
      avgRating: publishedStats.avgRating
        ? Number(publishedStats.avgRating.toFixed(2))
        : 0,
      pendingCount: Number(totals.pendingCount || 0),
      publishedCount: Number(totals.publishedCount || 0),
      hiddenCount: Number(totals.hiddenCount || 0),
      rejectedCount: Number(totals.rejectedCount || 0),
      reportedCount,
      negativeCount: Number(publishedStats.negativeCount || 0),
      verifiedRate: visibleCount
        ? Number(publishedStats.verifiedCount || 0) / visibleCount
        : 0,
      replyRate: visibleCount ? official.length / visibleCount : 0,
      avgFirstReplyMinutes: replyMinutes.length
        ? Math.round(
            replyMinutes.reduce((total, value) => total + value, 0) /
              replyMinutes.length,
          )
        : 0,
      ratingTrend: summary?.ratingTrend || [],
      ratingBreakdown,
      topTags: summary?.topTags || [],
      topStaffMentioned: summary?.topStaffMentioned || [],
      lowRatedTargets: summary?.lowRatedTargets || [],
      reportBreakdown: summary?.reportBreakdown || [],
      actionQueueCounts: {
        needsModeration: reportedCount,
        needsReply: Number(
          summary?.negativeUnrepliedReviews?.[0]?.count || 0,
        ),
        highRisk: Number(totals.highRisk || 0),
      },
    };

    const insight = await generateReviewInsight(reviewIds, analytics);
    return {
      ...analytics,
      reviewInsightSummary: insight,
      recommendedActions: insight.recommendedActions,
      insightSource: insight.source,
    };
  },

  reviewTimeline: async (_, { reviewId, limit = 50 }, ctx) => {
    const review = await Review.findById(reviewId).lean();
    if (!review) return [];
    await requireReviewModerationAccess(ctx, review);
    const rows = await EventLog.find({
      "object.kind": "Review",
      "object.id": review._id,
      verb: /^review\./,
    })
      .sort({ at: -1, createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 100))
      .lean({ virtuals: true });
    return rows.map((row) => ({ id: String(row._id), ...row }));
  },
};
