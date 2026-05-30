// src/graphql/reviews/index.js

import reviewQuery from "./query.js";
import reviewMutation from "./mutation.js";

export default {
  Query: {
    ...reviewQuery,
  },
  Mutation: {
    ...reviewMutation,
  },
  Review: {
    firstOfficialReply: async (parent) => {
      if (Object.prototype.hasOwnProperty.call(parent || {}, "firstOfficialReply")) return parent.firstOfficialReply;
      const reviewId = parent?._id || parent?.id;
      if (!reviewId) return null;
      const { ReviewComment } = await import("../../../models/index.js");
      return ReviewComment.findOne({ reviewId, officialReply: true, status: "published" }).sort({ createdAt: 1 }).lean({ virtuals: true });
    },
  },
  ReactionSummary: {
    total: (parent = {}) =>
      ["like", "love", "care", "haha", "wow", "sad", "angry"].reduce(
        (sum, key) => sum + Number(parent?.[key] || 0),
        0,
      ),
  },
};
