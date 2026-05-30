import { GraphQLError } from "graphql";
import Review from "../../../models/review.model.js";
import { ReviewComment, ReviewReport } from "../../../models/index.js";
import { requirePermission, requireRestaurantAccess } from "../../guards.js";

function roleSlug(user) { return String(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || "").toLowerCase(); }
function isAdmin(user) { return roleSlug(user).includes("admin"); }
function isStaffLike(user) { const role = roleSlug(user); return role.includes("staff") || role.includes("manager") || role.includes("admin"); }
function isOwner(ctx, doc) { const uid = ctx?.user?.id || ctx?.user?._id; return uid && String(doc?.customerId || doc?.createdBy || doc?.userId) === String(uid); }
function forbidden(message = "Forbidden") { return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } }); }
async function requireReviewModerationAccess(ctx, review) { requirePermission(ctx, "review.read"); await requireRestaurantAccess(ctx, review.restaurantId); }

async function canManageRestaurant(ctx, restaurantId, permission = "review.read") {
  if (!ctx?.user) return false;
  if (isAdmin(ctx.user)) return true;
  try { requirePermission(ctx, permission); await requireRestaurantAccess(ctx, restaurantId); return true; } catch (_) { return false; }
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
  return items.map((item) => ({ ...item, firstOfficialReply: firstByReview.get(String(item._id || item.id)) || null }));
}

export default {
  reviews: async (_, { restaurantId, targetType, targetId, status, minRating, maxRating, limit = 20, skip = 0 }, ctx) => {
    const filter = {};
    if (restaurantId) filter.restaurantId = restaurantId;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;

    const canModerate = restaurantId ? await canManageRestaurant(ctx, restaurantId, "review.read") : isAdmin(ctx?.user);
    if (status) {
      if (status !== "published" && !canModerate) throw forbidden();
      filter.status = status;
    } else if (!canModerate) {
      const uid = ctx?.user?.id || ctx?.user?._id;
      filter.$or = [{ status: { $in: ["published", "reported"] } }, ...(uid ? [{ customerId: uid }] : [])];
    }
    if (minRating) filter.rating = { ...(filter.rating || {}), $gte: minRating };
    if (maxRating) filter.rating = { ...(filter.rating || {}), $lte: maxRating };
    const safeLimit = Math.min(Number(limit) || 20, 100);
    const total = await Review.countDocuments(filter);
    const items = await Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean({ virtuals: true });
    return { total, items: await attachFirstOfficialReplies(items) };
  },

  review: async (_, { id }, ctx) => {
    const doc = await Review.findById(id).lean({ virtuals: true });
    if (!doc) return null;
    const withReply = (await attachFirstOfficialReplies([doc]))[0];
    if (["published", "reported"].includes(doc.status) || isOwner(ctx, doc)) return withReply;
    await requireReviewModerationAccess(ctx, doc);
    return withReply;
  },

  reviewStats: async (_, { restaurantId, targetType, targetId }, ctx) => {
    const filter = {};
    if (restaurantId) filter.restaurantId = restaurantId;
    if (targetType) filter.targetType = targetType;
    if (targetId) filter.targetId = targetId;
    const canAllStatuses = restaurantId ? await canManageRestaurant(ctx, restaurantId, "review.read") : isAdmin(ctx?.user);
    if (!canAllStatuses) filter.status = { $in: ["published", "reported"] };
    const total = await Review.countDocuments(filter);
    const pending = canAllStatuses ? await Review.countDocuments({ ...filter, status: "pending" }) : 0;
    const ratingAgg = await Review.aggregate([{ $match: filter }, { $group: { _id: null, avg: { $avg: "$rating" } } }]);
    const avgRating = ratingAgg.length > 0 ? Number(ratingAgg[0].avg.toFixed(2)) : 0;
    const breakdownAgg = await Review.aggregate([{ $match: filter }, { $group: { _id: "$rating", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    breakdownAgg.forEach((item) => { ratingBreakdown[item._id] = item.count; });
    return { total, pending, avgRating, ratingBreakdown };
  },

  reviewReports: async (_, { restaurantId, status, reason, limit = 20, skip = 0 }, ctx) => {
    requirePermission(ctx, "review.report.read");
    if (restaurantId) await requireRestaurantAccess(ctx, restaurantId);
    else if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");
    const filter = {};
    if (restaurantId) filter.restaurantId = restaurantId;
    if (status) filter.status = status;
    if (reason) filter.reason = reason;
    const safeLimit = Math.min(Number(limit) || 20, 100);
    const total = await ReviewReport.countDocuments(filter);
    const items = await ReviewReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean({ virtuals: true });
    return { total, items };
  },

  reviewReportStats: async (_, { restaurantId }, ctx) => {
    requirePermission(ctx, "review.report.read");
    if (restaurantId) await requireRestaurantAccess(ctx, restaurantId);
    else if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");
    const match = restaurantId ? { restaurantId } : {};
    const rows = await ReviewReport.aggregate([{ $match: match }, { $group: { _id: { status: "$status", reason: "$reason" }, count: { $sum: 1 } } }]);
    const byStatus = {}; const byReason = {}; let total = 0;
    rows.forEach((row) => { total += row.count; byStatus[row._id.status] = (byStatus[row._id.status] || 0) + row.count; byReason[row._id.reason] = (byReason[row._id.reason] || 0) + row.count; });
    return { total, pending: byStatus.pending || 0, resolved: byStatus.resolved || 0, rejected: byStatus.rejected || 0, byReason };
  },

  reviewAnalytics: async (_, { restaurantId, targetType, dateFrom, dateTo }, ctx) => {
    requirePermission(ctx, "review.analytics.read");
    if (restaurantId) await requireRestaurantAccess(ctx, restaurantId);
    else if (!isAdmin(ctx?.user)) throw forbidden("restaurantId is required");
    const match = { ...dateFilter(dateFrom, dateTo) };
    if (restaurantId) match.restaurantId = restaurantId;
    if (targetType) match.targetType = targetType;
    const rows = await Review.find(match).lean();
    const published = rows.filter((r) => r.status === "published" || r.status === "reported");
    const count = (status) => rows.filter((r) => r.status === status).length;
    const avgRating = published.length ? Number((published.reduce((sum, r) => sum + Number(r.rating || 0), 0) / published.length).toFixed(2)) : 0;
    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    published.forEach((r) => { ratingBreakdown[r.rating] = (ratingBreakdown[r.rating] || 0) + 1; });
    const official = await ReviewComment.aggregate([{ $match: { reviewId: { $in: rows.map((r) => r._id) }, officialReply: true, status: "published" } }, { $group: { _id: "$reviewId", first: { $min: "$createdAt" } } }]);
    const repliedIds = new Set(official.map((x) => String(x._id)));
    const replyMinutes = official.map((x) => { const review = rows.find((r) => String(r._id) === String(x._id)); return review ? (new Date(x.first) - new Date(review.createdAt)) / 60000 : null; }).filter((x) => Number.isFinite(x) && x >= 0);
    const trendMap = new Map();
    published.forEach((r) => { const day = new Date(r.createdAt).toISOString().slice(0, 10); const cur = trendMap.get(day) || { date: day, total: 0, ratingSum: 0, avgRating: 0 }; cur.total += 1; cur.ratingSum += Number(r.rating || 0); cur.avgRating = Number((cur.ratingSum / cur.total).toFixed(2)); trendMap.set(day, cur); });
    const tagCounts = new Map(); const staffCounts = new Map(); const targetCounts = new Map(); const reportCounts = new Map();
    rows.forEach((r) => { (r.tags || []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)); (r.topicTags || []).forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1)); if (r.staffId) staffCounts.set(String(r.staffId), { id: String(r.staffId), name: r.staffName || "", count: ((staffCounts.get(String(r.staffId)) || {}).count || 0) + 1 }); if (Number(r.rating) <= 2) targetCounts.set(String(r.targetId), { id: String(r.targetId), name: r.targetName || "", targetType: r.targetType, count: ((targetCounts.get(String(r.targetId)) || {}).count || 0) + 1, avgRating: 0 }); if (r.reportsCount) reportCounts.set(r.status, (reportCounts.get(r.status) || 0) + Number(r.reportsCount || 0)); });
    const negativeUnreplied = published.filter((r) => Number(r.rating) <= 2 && !repliedIds.has(String(r._id))).length;
    return {
      totalReviews: rows.length, avgRating, pendingCount: count("pending"), publishedCount: count("published"), hiddenCount: count("hidden"), rejectedCount: count("rejected"), reportedCount: count("reported"), negativeCount: published.filter((r) => Number(r.rating) <= 2).length,
      verifiedRate: published.length ? published.filter((r) => r.verifiedPurchase).length / published.length : 0,
      replyRate: published.length ? repliedIds.size / published.length : 0,
      avgFirstReplyMinutes: replyMinutes.length ? Math.round(replyMinutes.reduce((a,b) => a + b, 0) / replyMinutes.length) : 0,
      ratingTrend: Array.from(trendMap.values()).sort((a,b) => a.date.localeCompare(b.date)),
      ratingBreakdown,
      topTags: Array.from(tagCounts.entries()).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count).slice(0, 10),
      topStaffMentioned: Array.from(staffCounts.values()).sort((a,b) => b.count - a.count).slice(0, 10),
      lowRatedTargets: Array.from(targetCounts.values()).sort((a,b) => b.count - a.count).slice(0, 10),
      reportBreakdown: Array.from(reportCounts.entries()).map(([name, count]) => ({ name, count })),
      actionQueueCounts: { needsModeration: count("pending") + count("reported"), needsReply: negativeUnreplied, highRisk: rows.filter((r) => Number(r.reportsCount || 0) >= 3 || Number(r.rating) <= 1).length },
    };
  },
};
