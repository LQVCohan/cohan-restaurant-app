// src/graphql/reviewCommentReaction/reviewCommentReaction.query.js
import { ReviewCommentReaction } from "../../../models/index.js";

export default {
  // Lấy danh sách reaction của 1 comment
  reviewCommentReactions: async (_, { commentId }) => {
    return ReviewCommentReaction.find({ commentId }).lean({ virtuals: true });
  },

  // Tổng hợp reaction dùng cho admin / debug (không bắt buộc dùng trong FE)
  reviewCommentReactionSummary: async (_, { commentId }) => {
    const pipeline = [
      { $match: { commentId } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ];

    const rows = await ReviewCommentReaction.aggregate(pipeline);

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
