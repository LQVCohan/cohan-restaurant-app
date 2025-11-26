// src/graphql/reviewReaction/reviewReaction.mutation.js

import ReviewReaction, {
  ReviewReactionTypes,
} from "../../models/review-reaction.model.js";
import Review from "../../models/review.model.js";
import EventLog from "../../models/event-log.model.js";

export default {
  /**
   * User react vào review
   * - Nếu chưa có → tạo
   * - Nếu đã tồn tại → đổi reaction
   * - Nếu bấm lại reaction cũ → bỏ reaction
   */
  reactReview: async (_, { reviewId, type }, ctx) => {
    const userId = ctx?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    if (!ReviewReactionTypes.includes(type))
      throw new Error("Reaction không hợp lệ");

    const review = await Review.findById(reviewId);
    if (!review) throw new Error("Review không tồn tại");

    const restaurantId = review.restaurantId;

    // Kiểm tra user đã react chưa
    const existing = await ReviewReaction.findOne({ reviewId, userId });

    let reactionDoc;

    if (!existing) {
      // Tạo mới
      reactionDoc = await ReviewReaction.create({
        reviewId,
        restaurantId,
        userId,
        type,
      });
    } else if (existing.type === type) {
      // Bấm lại → bỏ reaction
      await existing.deleteOne();

      await EventLog.log({
        restaurantId,
        verb: "review.reaction.remove",
        object: { kind: "Review", id: reviewId },
        actorUserId: userId,
        meta: { type },
      });

      return {
        ...review.toObject(),
        reactionRemoved: true,
      };
    } else {
      // Đổi reaction
      existing.type = type;
      await existing.save();
      reactionDoc = existing;
    }

    // Log
    await EventLog.log({
      restaurantId,
      verb: "review.reaction.set",
      object: { kind: "Review", id: reviewId },
      actorUserId: userId,
      meta: { type },
    });

    return review;
  },
};
