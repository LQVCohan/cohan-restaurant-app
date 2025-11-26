// src/graphql/reviewReaction/reviewReaction.query.js

import ReviewReaction from "../../models/review-reaction.model.js";
import Review from "../../models/review.model.js";

export default {
  /**
   * Lấy danh sách reaction cho 1 review
   * Optionally: group theo type
   */
  reviewReactions: async (_, { reviewId }) => {
    return ReviewReaction.find({ reviewId }).lean({ virtuals: true });
  },

  /**
   * Lấy tổng hợp reaction (giống ReactionSummary FE dùng)
   */
  reviewReactionSummary: async (_, { reviewId }) => {
    const pipeline = [
      { $match: { reviewId } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ];

    const rows = await ReviewReaction.aggregate(pipeline);
    const summary = {
      like: 0,
      love: 0,
      care: 0,
      haha: 0,
      wow: 0,
      sad: 0,
      angry: 0,
      total: 0,
    };

    rows.forEach((r) => {
      summary[r._id] = r.count;
      summary.total += r.count;
    });

    return summary;
  },
};
