import { GraphQLError } from "graphql";
import { Review, ReviewComment, EventLog } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

function roleSlug(user) { return String(user?.roleName || user?.role?.slug || user?.role?.name || user?.userType || "").toLowerCase(); }
function isStaffLike(user) { const role = roleSlug(user); return role.includes("staff") || role.includes("manager") || role.includes("admin"); }
function isOwner(ctx, doc) { const uid = ctx?.user?.id; return uid && String(doc?.createdBy || doc?.userId) === String(uid); }
function forbidden(message = "Forbidden") { return new GraphQLError(message, { extensions: { code: "FORBIDDEN" } }); }

export default {
  createReviewComment: async (_, { input }, ctx) => {
    if (!ctx?.user?.id) throw new Error("Login required");
    const { reviewId, parentId } = input;
    const review = await Review.findById(reviewId);
    if (!review) throw new Error("Review not found");
    if (review.status !== "published") {
      if (!isOwner(ctx, review)) { if (!isStaffLike(ctx?.user)) throw forbidden(); await requireRestaurantAccess(ctx, review.restaurantId); }
    }
    if (parentId) {
      const parent = await ReviewComment.findById(parentId);
      if (!parent || String(parent.reviewId) !== String(reviewId) || String(parent.restaurantId) !== String(review.restaurantId)) {
        throw new Error("Parent comment mismatch");
      }
    }
    const comment = await ReviewComment.create({ ...input, restaurantId: review.restaurantId, createdBy: ctx.user.id, status: "published", isEdited: false });
    if (parentId) await ReviewComment.updateOne({ _id: parentId }, { $inc: { repliesCount: 1 } });
    else await Review.updateOne({ _id: reviewId }, { $inc: { commentsCount: 1 } });
    await EventLog.log({ restaurantId: review.restaurantId, verb: "review.comment.create", object: { kind: "ReviewComment", id: comment.id }, target: { kind: "Review", id: reviewId }, actorUserId: ctx?.user?.id, meta: input });
    return comment;
  },
  updateReviewComment: async (_, { id, input }, ctx) => {
    const comment = await ReviewComment.findById(id);
    if (!comment) throw new Error("Comment không tồn tại");
    const patch = { ...input, isEdited: true };
    delete patch.restaurantId; delete patch.reviewId; delete patch.parentId; delete patch.createdBy; delete patch.reactions;
    if (isOwner(ctx, comment)) delete patch.status;
    else { if (!isStaffLike(ctx?.user)) throw forbidden(); await requireRestaurantAccess(ctx, comment.restaurantId); }
    await comment.updateOne(patch);
    const updated = await ReviewComment.findById(id);
    await EventLog.log({ restaurantId: updated.restaurantId, verb: "review.comment.update", object: { kind: "ReviewComment", id }, actorUserId: ctx?.user?.id, diff: input });
    return updated;
  },
  deleteReviewComment: async (_, { id }, ctx) => {
    const comment = await ReviewComment.findById(id);
    if (!comment) return false;
    if (!isOwner(ctx, comment)) { if (!isStaffLike(ctx?.user)) throw forbidden(); await requireRestaurantAccess(ctx, comment.restaurantId); }
    const { reviewId, restaurantId, parentId } = comment;
    await comment.deleteOne();
    if (parentId) await ReviewComment.updateOne({ _id: parentId }, { $inc: { repliesCount: -1 } });
    else await Review.updateOne({ _id: reviewId }, { $inc: { commentsCount: -1 } });
    await EventLog.log({ restaurantId, verb: "review.comment.delete", object: { kind: "ReviewComment", id }, actorUserId: ctx?.user?.id });
    return true;
  },
  setReviewCommentStatus: async (_, { id, status }, ctx) => {
    const comment = await ReviewComment.findById(id);
    if (!comment) throw new Error("Comment không tồn tại");
    if (!isStaffLike(ctx?.user)) throw forbidden();
    await requireRestaurantAccess(ctx, comment.restaurantId);
    await comment.updateOne({ status });
    const updated = await ReviewComment.findById(id);
    await EventLog.log({ restaurantId: updated.restaurantId, verb: "review.comment.status", object: { kind: "ReviewComment", id }, actorUserId: ctx?.user?.id, meta: { status } });
    return updated;
  },
  reactReviewComment: async (_, { id, reaction }, ctx) => {
    if (!ctx?.user?.id) throw new Error("Login required");
    const valid = ["like", "love", "care", "haha", "wow", "sad", "angry"];
    const key = (reaction || "").toLowerCase();
    if (!valid.includes(key)) throw new Error("Reaction không hợp lệ");
    const comment = await ReviewComment.findById(id);
    if (!comment) throw new Error("Comment không tồn tại");
    if (comment.status !== "published") throw forbidden();
    await comment.updateOne({ $inc: { [`reactions.${key}`]: 1, likesCount: key === "like" ? 1 : 0 } });
    const updated = await ReviewComment.findById(id);
    await EventLog.log({ restaurantId: updated.restaurantId, verb: "review.comment.reaction", object: { kind: "ReviewComment", id }, actorUserId: ctx?.user?.id, meta: { reaction: key } });
    return updated;
  },
};
