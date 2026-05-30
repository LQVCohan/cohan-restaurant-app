import { Notification, Restaurant, Review, ReviewHelpful, ReviewReaction, ReviewReport } from "../../../models/index.js";
import { requirePermission, requireRestaurantAccess } from "../../guards.js";
import { logReviewEvent } from "../../../utils/logReview.js";
import {
  REVIEW_REACTION_TYPES,
  REVIEW_REPORT_REASONS,
  REVIEW_STATUSES,
  analyzeReviewText,
  badUserInput,
  buildReactionIncPayload,
  clampReactionSummary,
  deriveCustomerIdentity,
  forbidden,
  normalizeReviewInput,
  normalizeReviewStaff,
  normalizeReviewTargetForPersistence,
  resolveVerifiedReview,
  unauthenticated,
  validateReviewTarget,
} from "../../../src/services/reviewHardening.service.js";

function isOwner(ctx, doc) {
  const uid = ctx?.user?.id || ctx?.user?._id;
  return uid && String(doc?.customerId || doc?.createdBy || doc?.userId) === String(uid);
}

async function recalcReviewReportCount(reviewId) {
  const reportsCount = await ReviewReport.countDocuments({ reviewId, status: "pending" });
  return reportsCount;
}

async function createReviewNotification({ review, type, message, toUserId = null, toRole = null, ctx, payload = {} }) {
  try {
    await Notification.create({
      toUserId: toUserId || undefined,
      toRole: toRole || undefined,
      restaurantId: review.restaurantId,
      type,
      payload: {
        reviewId: review.id || String(review._id),
        rating: review.rating,
        status: review.status,
        targetType: review.targetType,
        targetName: review.targetName,
        message,
        ...payload,
      },
    });
  } catch (err) {
    await logReviewEvent({ review, verb: "review.notification.failed", ctx, meta: { type, message, error: err.message } });
  }
}

async function notifyRestaurantManagers({ review, type, message, ctx, payload = {} }) {
  const restaurant = await Restaurant.findById(review.restaurantId).select("managerId").lean();
  if (restaurant?.managerId) {
    await createReviewNotification({ review, type, message, toUserId: restaurant.managerId, ctx, payload });
    return;
  }
  await createReviewNotification({ review, type, message, toRole: "manager", ctx, payload });
}

export default {
  createReview: async (_, { input }, ctx) => {
    if (!ctx?.user?.id && !ctx?.user?._id) throw unauthenticated();
    const userId = ctx.user.id || ctx.user._id;
    const normalized = normalizeReviewInput(input);
    const serviceTarget = await validateReviewTarget({ targetType: input.targetType, targetId: input.targetId, restaurantId: input.restaurantId });
    const { targetId: normalizedTargetId, targetName: normalizedTargetName } = normalizeReviewTargetForPersistence({
      targetId: input.targetId,
      targetName: input.targetName,
      serviceTarget,
    });

    const duplicateSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const duplicate = await Review.findOne({
      customerId: userId,
      restaurantId: input.restaurantId,
      targetType: input.targetType,
      targetId: normalizedTargetId,
      status: { $in: ["pending", "published", "reported"] },
      createdAt: { $gte: duplicateSince },
    }).lean();
    if (duplicate) throw badUserInput("Bạn đã gửi đánh giá cho mục này gần đây. Vui lòng cập nhật đánh giá hiện có hoặc thử lại sau.");

    const identity = deriveCustomerIdentity(ctx);
    const staff = await normalizeReviewStaff({ staffId: input?.staffId, restaurantId: input.restaurantId });
    const verified = await resolveVerifiedReview({ userId, restaurantId: input.restaurantId, targetType: input.targetType, targetId: normalizedTargetId });
    const insight = analyzeReviewText(normalized.title, normalized.content);
    const payload = {
      targetType: input.targetType,
      targetId: normalizedTargetId,
      targetName: normalizedTargetName,
      restaurantId: input.restaurantId,
      restaurantName: String(input.restaurantName || "").trim(),
      ...identity,
      ...staff,
      ...normalized,
      ...verified,
      ...insight,
      status: "pending",
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      helpfulCount: 0,
      reportsCount: 0,
      createdBy: userId,
    };
    const created = await Review.create(payload);
    await logReviewEvent({ review: created, verb: "review.create", ctx, meta: { rating: created.rating, verifiedSource: created.verifiedSource } });
    if (Number(created.rating) <= 2) {
      await notifyRestaurantManagers({
        review: created,
        type: "review.negative.created",
        message: "Có đánh giá tiêu cực cần xử lý",
        ctx,
        payload: { customerName: created.customerName },
      });
      await logReviewEvent({ review: created, verb: "review.notification.negative", ctx, meta: { channel: "in-app" } });
    }
    return created;
  },

  updateReview: async (_, { id, input }, ctx) => {
    const before = await Review.findById(id);
    if (!before) throw new Error("Review not found");
    const patch = {};

    if (isOwner(ctx, before)) {
      if (!["pending", "rejected"].includes(before.status)) throw forbidden("Đánh giá đã công khai không thể tự chỉnh sửa. Vui lòng liên hệ nhà hàng.");
      const normalized = normalizeReviewInput({ ...before.toObject(), ...input, rating: input.rating ?? before.rating, content: input.content ?? before.content });
      Object.assign(patch, normalized, analyzeReviewText(normalized.title, normalized.content));
    } else {
      requirePermission(ctx, "review.moderate");
      await requireRestaurantAccess(ctx, before.restaurantId);
      if (Object.prototype.hasOwnProperty.call(input || {}, "status")) {
        if (!REVIEW_STATUSES.includes(input.status)) throw badUserInput("Trạng thái review không hợp lệ.");
        patch.status = input.status;
      }
      if (Object.prototype.hasOwnProperty.call(input || {}, "rating") || Object.prototype.hasOwnProperty.call(input || {}, "content") || Object.prototype.hasOwnProperty.call(input || {}, "title") || Object.prototype.hasOwnProperty.call(input || {}, "images") || Object.prototype.hasOwnProperty.call(input || {}, "tags")) {
        Object.assign(patch, normalizeReviewInput({ ...before.toObject(), ...input, rating: input.rating ?? before.rating, content: input.content ?? before.content }));
      }
    }

    delete patch.restaurantId; delete patch.customerId; delete patch.customerName; delete patch.customerAvatar; delete patch.staffName; delete patch.verifiedPurchase; delete patch.verifiedSource; delete patch.verifiedSourceId; delete patch.helpfulCount; delete patch.reportsCount; delete patch.likesCount; delete patch.reactions;
    if (Object.prototype.hasOwnProperty.call(input || {}, "staffId")) Object.assign(patch, await normalizeReviewStaff({ staffId: input?.staffId, restaurantId: before.restaurantId }));
    patch.updatedBy = ctx?.user?.id || ctx?.user?._id || null;
    const updated = await Review.findByIdAndUpdate(id, patch, { new: true });
    await logReviewEvent({ review: updated, verb: "review.update", ctx, diff: { before: { rating: before.rating, status: before.status }, after: { rating: updated.rating, status: updated.status } } });
    return updated;
  },

  deleteReview: async (_, { id }, ctx) => {
    const review = await Review.findById(id);
    if (!review) return false;
    if (!isOwner(ctx, review)) {
      requirePermission(ctx, "review.delete");
      await requireRestaurantAccess(ctx, review.restaurantId);
    }
    await Review.findByIdAndUpdate(id, { status: "hidden", moderationReason: "deleted", moderatedBy: ctx?.user?.id || ctx?.user?._id || null, moderatedAt: new Date(), updatedBy: ctx?.user?.id || ctx?.user?._id || null });
    await logReviewEvent({ review, verb: "review.softDelete", ctx, diff: { from: review.status, to: "hidden" } });
    return true;
  },

  setReviewStatus: async (_, { id, status, reason = "", moderationNote = "", notifyCustomer = false }, ctx) => {
    if (!REVIEW_STATUSES.includes(status)) throw badUserInput("Trạng thái review không hợp lệ.");
    const before = await Review.findById(id);
    if (!before) throw new Error("Review not found");
    requirePermission(ctx, "review.moderate");
    await requireRestaurantAccess(ctx, before.restaurantId);
    const updated = await Review.findByIdAndUpdate(id, { status, moderationReason: reason, moderationNote, moderatedBy: ctx?.user?.id || ctx?.user?._id || null, moderatedAt: new Date(), updatedBy: ctx?.user?.id || ctx?.user?._id || null }, { new: true });
    await logReviewEvent({ review: updated, verb: "review.status", ctx, diff: { from: before.status, to: status }, meta: { reason, moderationNote, notifyCustomer } });
    if (["published", "rejected"].includes(status) && updated.customerId) {
      const message = status === "published" ? "Đánh giá của bạn đã được duyệt" : "Đánh giá của bạn đã bị từ chối";
      await createReviewNotification({ review: updated, type: `review.${status}`, message, toUserId: updated.customerId, ctx, payload: { moderationReason: reason, moderationNote } });
      await logReviewEvent({ review: updated, verb: "review.notification.customer", ctx, meta: { channel: "in-app", status } });
    }
    return updated;
  },

  incrementReviewHelpful: async (_, { id }, ctx) => {
    const userId = ctx?.user?.id || ctx?.user?._id;
    if (!userId) throw unauthenticated();
    const review = await Review.findById(id);
    if (!review) return null;
    if (review.status !== "published") throw forbidden();
    const existing = await ReviewHelpful.findOne({ reviewId: id, userId });
    const action = existing ? "unset" : "set";
    if (existing) await existing.deleteOne();
    else await ReviewHelpful.create({ reviewId: id, restaurantId: review.restaurantId, userId, createdBy: userId });
    const delta = existing ? -1 : 1;
    const updated = await Review.findByIdAndUpdate(id, { $inc: { helpfulCount: delta }, updatedBy: userId }, { new: true });
    const clamps = clampReactionSummary(updated);
    if (Object.keys(clamps).length) await Review.updateOne({ _id: id }, { $set: clamps });
    const finalDoc = Object.keys(clamps).length ? await Review.findById(id) : updated;
    await logReviewEvent({ review: finalDoc, verb: "review.helpful", ctx, meta: { action, helpfulCount: finalDoc.helpfulCount } });
    return finalDoc;
  },

  reactReview: async (_, { id, reaction }, ctx) => {
    const userId = ctx?.user?.id || ctx?.user?._id;
    if (!userId) throw unauthenticated();
    const key = String(reaction || "").toLowerCase();
    if (!REVIEW_REACTION_TYPES.includes(key)) throw badUserInput("Reaction không hợp lệ");
    const review = await Review.findById(id);
    if (!review) throw new Error("Review not found");
    if (review.status !== "published") throw forbidden();
    const existing = await ReviewReaction.findOne({ reviewId: id, userId });
    let inc = {}; let dec = {}; let action = "set";
    if (!existing) { await ReviewReaction.create({ reviewId: id, restaurantId: review.restaurantId, userId, type: key, createdBy: userId }); inc[key] = 1; }
    else if (existing.type === key) { await existing.deleteOne(); dec[key] = 1; action = "unset"; }
    else { const old = existing.type; existing.type = key; existing.updatedBy = userId; await existing.save(); dec[old] = 1; inc[key] = 1; action = "change"; }
    const updated = await Review.findByIdAndUpdate(id, { $inc: buildReactionIncPayload({ inc, dec }), updatedBy: userId }, { new: true });
    const clamps = clampReactionSummary(updated);
    if (Object.keys(clamps).length) await Review.updateOne({ _id: id }, { $set: clamps });
    const finalDoc = Object.keys(clamps).length ? await Review.findById(id) : updated;
    await logReviewEvent({ review: finalDoc, verb: "review.react", ctx, meta: { reaction: key, action } });
    return finalDoc;
  },

  reportReview: async (_, { id, input = {} }, ctx) => {
    const userId = ctx?.user?.id || ctx?.user?._id;
    if (!userId) throw unauthenticated();
    const review = await Review.findById(id);
    if (!review) throw new Error("Review not found");
    if (review.status !== "published" && review.status !== "reported") throw forbidden();
    const reason = String(input.reason || "other").toLowerCase();
    if (!REVIEW_REPORT_REASONS.includes(reason)) throw badUserInput("Lý do báo cáo không hợp lệ.");
    const report = await ReviewReport.findOneAndUpdate(
      { reviewId: id, reporterUserId: userId, reason },
      { $setOnInsert: { reviewId: id, restaurantId: review.restaurantId, reporterUserId: userId, reason, createdBy: userId }, $set: { detail: String(input.detail || "").trim().slice(0, 1000), status: "pending", updatedBy: userId } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    const reportsCount = await recalcReviewReportCount(id);
    const nextStatus = reportsCount >= 3 || ["abuse", "offensive", "privacy"].includes(reason) ? "reported" : review.status;
    const updated = await Review.findByIdAndUpdate(id, { reportsCount, status: nextStatus, updatedBy: userId }, { new: true });
    await logReviewEvent({ review: updated, verb: "review.report.create", ctx, meta: { reportId: report.id, reason, reportsCount } });
    await notifyRestaurantManagers({ review: updated, type: "review.reported", message: "Có báo cáo đánh giá mới cần xử lý", ctx, payload: { reportId: report.id, reason, reportsCount } });
    await logReviewEvent({ review: updated, verb: "review.notification.report", ctx, meta: { channel: "in-app", reason, reportsCount } });
    return report;
  },

  resolveReviewReport: async (_, { id, input = {} }, ctx) => {
    const report = await ReviewReport.findById(id);
    if (!report) throw new Error("Report not found");
    requirePermission(ctx, "review.report.resolve");
    await requireRestaurantAccess(ctx, report.restaurantId);
    const status = ["resolved", "rejected"].includes(input.status) ? input.status : "resolved";
    report.status = status;
    report.resolutionNote = String(input.resolutionNote || "").trim();
    report.resolvedBy = ctx?.user?.id || ctx?.user?._id || null;
    report.resolvedAt = new Date();
    report.updatedBy = report.resolvedBy;
    await report.save();
    const reportsCount = await recalcReviewReportCount(report.reviewId);
    const currentReview = await Review.findById(report.reviewId);
    const statusRestored = currentReview?.status === "reported" && reportsCount === 0;
    const review = await Review.findByIdAndUpdate(
      report.reviewId,
      { reportsCount, ...(statusRestored ? { status: "published" } : {}), updatedBy: report.resolvedBy },
      { new: true },
    );
    await logReviewEvent({ review, verb: "review.report.resolve", ctx, meta: { reportId: report.id, status, reportsCount, statusRestored } });
    return report;
  },
};
