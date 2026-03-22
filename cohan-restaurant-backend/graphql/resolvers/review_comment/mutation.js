import { Review, ReviewComment, EventLog } from "../../../models/index.js";

export default {
  // -------------------------------------------------
  // Create comment or reply
  // -------------------------------------------------
  createReviewComment: async (_, { input }, ctx) => {
    const { reviewId, restaurantId, parentId } = input;

    const comment = await ReviewComment.create({
      ...input,
      status: "published",
      isEdited: false,
    });

    // Update counter
    if (parentId) {
      await ReviewComment.updateOne(
        { _id: parentId },
        { $inc: { repliesCount: 1 } }
      );
    } else {
      await Review.updateOne({ _id: reviewId }, { $inc: { commentsCount: 1 } });
    }

    // Log
    await EventLog.log({
      restaurantId,
      verb: "review.comment.create",
      object: { kind: "ReviewComment", id: comment.id },
      target: { kind: "Review", id: reviewId },
      actorUserId: ctx?.user?.id,
      meta: input,
    });

    return comment;
  },

  // -------------------------------------------------
  // Update comment
  // -------------------------------------------------
  updateReviewComment: async (_, { id, input }, ctx) => {
    const comment = await ReviewComment.findById(id);
    if (!comment) throw new Error("Comment không tồn tại");

    await comment.updateOne({
      ...input,
      isEdited: true,
    });

    const updated = await ReviewComment.findById(id);

    await EventLog.log({
      restaurantId: updated.restaurantId,
      verb: "review.comment.update",
      object: { kind: "ReviewComment", id },
      actorUserId: ctx?.user?.id,
      diff: input,
    });

    return updated;
  },

  // -------------------------------------------------
  // Delete comment
  // -------------------------------------------------
  deleteReviewComment: async (_, { id }, ctx) => {
    const comment = await ReviewComment.findById(id);
    if (!comment) return false;

    const { reviewId, restaurantId, parentId } = comment;

    await comment.deleteOne();

    // Auto decrease counters
    if (parentId) {
      await ReviewComment.updateOne(
        { _id: parentId },
        { $inc: { repliesCount: -1 } }
      );
    } else {
      await Review.updateOne(
        { _id: reviewId },
        { $inc: { commentsCount: -1 } }
      );
    }

    await EventLog.log({
      restaurantId,
      verb: "review.comment.delete",
      object: { kind: "ReviewComment", id },
      actorUserId: ctx?.user?.id,
    });

    return true;
  },

  // -------------------------------------------------
  // Set Comment Status
  // -------------------------------------------------
  setReviewCommentStatus: async (_, { id, status }, ctx) => {
    const comment = await ReviewComment.findById(id);
    if (!comment) throw new Error("Comment không tồn tại");

    await comment.updateOne({ status });

    const updated = await ReviewComment.findById(id);

    await EventLog.log({
      restaurantId: updated.restaurantId,
      verb: "review.comment.status",
      object: { kind: "ReviewComment", id },
      actorUserId: ctx?.user?.id,
      meta: { status },
    });

    return updated;
  },

  // -------------------------------------------------
  // Reaction (like/love/haha…)
  // -------------------------------------------------
  reactReviewComment: async (_, { id, reaction }, ctx) => {
    const valid = ["like", "love", "care", "haha", "wow", "sad", "angry"];
    const key = (reaction || "").toLowerCase();
    if (!valid.includes(key)) throw new Error("Reaction không hợp lệ");

    const comment = await ReviewComment.findById(id);
    if (!comment) throw new Error("Comment không tồn tại");

    await comment.updateOne({
      $inc: { [`reactions.${key}`]: 1, likesCount: key === "like" ? 1 : 0 },
    });

    const updated = await ReviewComment.findById(id);

    await EventLog.log({
      restaurantId: updated.restaurantId,
      verb: "review.comment.reaction",
      object: { kind: "ReviewComment", id },
      actorUserId: ctx?.user?.id,
      meta: { reaction: key },
    });

    return updated;
  },
};
