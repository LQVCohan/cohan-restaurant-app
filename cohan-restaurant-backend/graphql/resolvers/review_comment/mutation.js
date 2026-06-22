import { GraphQLError } from "graphql";
import { Notification, Review, ReviewComment, ReviewCommentReaction, EventLog } from "../../../models/index.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";
import { REVIEW_REACTION_TYPES, buildReactionIncPayload, clampReactionSummary, deriveCustomerIdentity, forbidden, unauthenticated } from "../../../src/services/reviewHardening.service.js";

function roleSlug(user) { return String(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || "").toLowerCase(); }
function authorType(user) { const role = roleSlug(user); if (role.includes("admin")) return "admin"; if (role.includes("manager")) return "manager"; if (role.includes("staff")) return "staff"; return "customer"; }
function isOwner(ctx, doc) { const uid = ctx?.user?.id || ctx?.user?._id; return uid && String(doc?.authorUserId || doc?.createdBy || doc?.userId) === String(uid); }
async function logComment(payload) { try { await EventLog.log(payload); } catch (err) { console.error("EventLog review comment error:", err.message); } }
async function notifyOfficialReply({ review, comment, ctx }) {
  if (!review?.customerId) return;
  try {
    await Notification.create({
      toUserId: review.customerId,
      restaurantId: review.restaurantId,
      type: "review.official_reply.created",
      payload: {
        title: "Nhà hàng đã phản hồi review",
        message: "Nhà hàng đã phản hồi đánh giá của bạn",
        reviewId: review.id || String(review._id),
        commentId: comment.id || String(comment._id),
        restaurantId: String(review.restaurantId || ""),
        restaurantName: review.restaurantName || "",
        reviewTitle: review.title || "",
        rating: review.rating,
      },
    });
    if (ctx?.io) {
      ctx.io.to(`user_${review.customerId}`).emit("notificationCreated", {
        type: "review.official_reply.created",
        restaurantId: String(review.restaurantId || ""),
        reviewId: review.id || String(review._id),
        message: "Nhà hàng đã phản hồi đánh giá của bạn",
      });
    }
    await logComment({ restaurantId: review.restaurantId, verb: "review.notification.officialReply", object: { kind: "ReviewComment", id: comment.id }, target: { kind: "Review", id: review.id || review._id }, actorUserId: ctx?.user?.id, meta: { channel: "in-app" } });
  } catch (err) {
    await logComment({ restaurantId: review.restaurantId, verb: "review.notification.failed", object: { kind: "ReviewComment", id: comment.id }, target: { kind: "Review", id: review.id || review._id }, actorUserId: ctx?.user?.id, meta: { error: err.message } });
  }
}

export default {
  createReviewComment: async (_, { input }, ctx) => {
    if (!ctx?.user?.id && !ctx?.user?._id) throw unauthenticated();
    const { reviewId, parentId } = input;
    const review = await Review.findById(reviewId);
    if (!review) throw new Error("Review not found");
    const type = authorType(ctx.user);
    const wantsOfficial = Boolean(input.officialReply);
    if (review.status !== "published" && !(type !== "customer")) {
      throw forbidden();
    }
    if (review.status !== "published" && type !== "customer") {
      await requireRestaurantPermission(ctx, review.restaurantId, "review.reply");
    }
    if (wantsOfficial) {
      await requireRestaurantPermission(ctx, review.restaurantId, "review.reply");
    }
    if (parentId) {
      const parent = await ReviewComment.findById(parentId);
      if (!parent || String(parent.reviewId) !== String(reviewId) || String(parent.restaurantId) !== String(review.restaurantId)) throw new Error("Parent comment mismatch");
    }
    const content = String(input.content || "").trim();
    if (!content) throw new GraphQLError("Nội dung phản hồi không được để trống", { extensions: { code: "BAD_USER_INPUT" } });
    const identity = deriveCustomerIdentity(ctx);
    const officialReply = wantsOfficial && type !== "customer";
    const comment = await ReviewComment.create({
      reviewId,
      parentId: parentId || null,
      restaurantId: review.restaurantId,
      authorUserId: ctx.user.id || ctx.user._id,
      authorName: officialReply ? (ctx.user.fullName || ctx.user.name || review.restaurantName || "Nhà hàng") : identity.customerName,
      authorAvatar: identity.customerAvatar,
      authorRole: roleSlug(ctx.user) || type,
      authorType: officialReply ? type : "customer",
      officialReply,
      replyByRestaurantId: officialReply ? review.restaurantId : null,
      content,
      createdBy: ctx.user.id || ctx.user._id,
      status: "published",
      isEdited: false,
    });
    if (parentId) await ReviewComment.updateOne({ _id: parentId }, { $inc: { repliesCount: 1 } });
    else await Review.updateOne({ _id: reviewId }, { $inc: { commentsCount: 1 }, ...(officialReply && !review.firstOfficialReplyAt ? { $set: { firstOfficialReplyAt: new Date() } } : {}) });
    await logComment({ restaurantId: review.restaurantId, verb: "review.comment.create", object: { kind: "ReviewComment", id: comment.id }, target: { kind: "Review", id: reviewId }, actorUserId: ctx?.user?.id, meta: { officialReply } });
    if (officialReply) await notifyOfficialReply({ review, comment, ctx });
    return comment;
  },

  updateReviewComment: async (_, { id, input }, ctx) => {
    const comment = await ReviewComment.findById(id);
    if (!comment) throw new Error("Comment không tồn tại");
    const patch = {};
    if (Object.prototype.hasOwnProperty.call(input || {}, "content")) {
      patch.content = String(input.content || "").trim();
      if (!patch.content) throw new GraphQLError("Nội dung không được để trống", { extensions: { code: "BAD_USER_INPUT" } });
      patch.isEdited = true;
    }
    if (isOwner(ctx, comment)) delete patch.status;
    else { await requireRestaurantPermission(ctx, comment.restaurantId, "review.moderate"); if (input.status) patch.status = input.status; }
    patch.updatedBy = ctx?.user?.id || ctx?.user?._id || null;
    await comment.updateOne(patch);
    const updated = await ReviewComment.findById(id);
    await logComment({ restaurantId: updated.restaurantId, verb: "review.comment.update", object: { kind: "ReviewComment", id }, actorUserId: ctx?.user?.id, diff: input });
    return updated;
  },

  deleteReviewComment: async (_, { id }, ctx) => {
    const comment = await ReviewComment.findById(id);
    if (!comment) return false;
    if (!isOwner(ctx, comment)) { await requireRestaurantPermission(ctx, comment.restaurantId, "review.delete"); }
    const { reviewId, restaurantId, parentId } = comment;
    await comment.updateOne({ status: "deleted", updatedBy: ctx?.user?.id || ctx?.user?._id || null });
    if (parentId) await ReviewComment.updateOne({ _id: parentId, repliesCount: { $gt: 0 } }, { $inc: { repliesCount: -1 } });
    else await Review.updateOne({ _id: reviewId, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } });
    await logComment({ restaurantId, verb: "review.comment.delete", object: { kind: "ReviewComment", id }, actorUserId: ctx?.user?.id });
    return true;
  },

  setReviewCommentStatus: async (_, { id, status }, ctx) => {
    const comment = await ReviewComment.findById(id);
    if (!comment) throw new Error("Comment không tồn tại");
    await requireRestaurantPermission(ctx, comment.restaurantId, "review.moderate");
    await comment.updateOne({ status, updatedBy: ctx?.user?.id || ctx?.user?._id || null });
    const updated = await ReviewComment.findById(id);
    await logComment({ restaurantId: updated.restaurantId, verb: "review.comment.status", object: { kind: "ReviewComment", id }, actorUserId: ctx?.user?.id, meta: { status } });
    return updated;
  },

  reactReviewComment: async (_, { id, reaction }, ctx) => {
    const userId = ctx?.user?.id || ctx?.user?._id;
    if (!userId) throw unauthenticated();
    const key = String(reaction || "").toLowerCase();
    if (!REVIEW_REACTION_TYPES.includes(key)) throw new GraphQLError("Reaction không hợp lệ", { extensions: { code: "BAD_USER_INPUT" } });
    const comment = await ReviewComment.findById(id);
    if (!comment) throw new Error("Comment không tồn tại");
    if (comment.status !== "published") throw forbidden();
    const existing = await ReviewCommentReaction.findOne({ commentId: id, userId });
    let inc = {}; let dec = {}; let action = "set";
    if (!existing) { await ReviewCommentReaction.create({ commentId: id, reviewId: comment.reviewId, restaurantId: comment.restaurantId, userId, type: key, createdBy: userId }); inc[key] = 1; }
    else if (existing.type === key) { await existing.deleteOne(); dec[key] = 1; action = "unset"; }
    else { const old = existing.type; existing.type = key; existing.updatedBy = userId; await existing.save(); dec[old] = 1; inc[key] = 1; action = "change"; }
    const updated = await ReviewComment.findByIdAndUpdate(id, { $inc: buildReactionIncPayload({ inc, dec }), updatedBy: userId }, { new: true });
    const clamps = clampReactionSummary(updated);
    if (Object.keys(clamps).length) await ReviewComment.updateOne({ _id: id }, { $set: clamps });
    const finalDoc = Object.keys(clamps).length ? await ReviewComment.findById(id) : updated;
    await logComment({ restaurantId: finalDoc.restaurantId, verb: "review.comment.react", object: { kind: "ReviewComment", id }, target: { kind: "Review", id: finalDoc.reviewId }, actorUserId: userId, meta: { reaction: key, action } });
    return finalDoc;
  },
};
