// src/graphql/reviews/index.js

import reviewQuery from "./query.js";
import reviewMutation from "./mutation.js";
import {
  resolveOwnerDeleteReview,
  resolveOwnerUpdateReview,
} from "./ownerMutation.js";
import {
  hasGroundedVerification,
  presentedVerifiedSource,
  resolvePresentedReviews,
  resolvePresentedReviewStats,
  toGraphqlDate,
} from "./presentation.js";

export default {
  Query: {
    ...reviewQuery,
    reviews: (root, args, ctx, info) =>
      resolvePresentedReviews(reviewQuery.reviews, root, args, ctx, info),
    reviewStats: resolvePresentedReviewStats,
  },
  Mutation: {
    ...reviewMutation,
    updateReview: (root, args, ctx, info) =>
      resolveOwnerUpdateReview(
        reviewMutation.updateReview,
        root,
        args,
        ctx,
        info,
      ),
    deleteReview: (root, args, ctx, info) =>
      resolveOwnerDeleteReview(
        reviewMutation.deleteReview,
        root,
        args,
        ctx,
        info,
      ),
  },
  Review: {
    createdAt: (parent) =>
      toGraphqlDate(parent?.createdAt, parent?._id || parent?.id),
    updatedAt: (parent) =>
      toGraphqlDate(
        parent?.updatedAt || parent?.createdAt,
        parent?._id || parent?.id,
      ),
    visitedAt: (parent) => toGraphqlDate(parent?.visitedAt),
    orderCompletedAt: (parent) => toGraphqlDate(parent?.orderCompletedAt),
    verifiedPurchase: (parent) => hasGroundedVerification(parent),
    verifiedSource: (parent) => presentedVerifiedSource(parent),
    verifiedSourceId: (parent) =>
      hasGroundedVerification(parent) ? parent?.verifiedSourceId || null : null,
    firstOfficialReply: async (parent) => {
      if (
        Object.prototype.hasOwnProperty.call(
          parent || {},
          "firstOfficialReply",
        )
      )
        return parent.firstOfficialReply;
      const reviewId = parent?._id || parent?.id;
      if (!reviewId) return null;
      const { ReviewComment } = await import("../../../models/index.js");
      return ReviewComment.findOne({
        reviewId,
        officialReply: true,
        status: "published",
      })
        .sort({ createdAt: 1 })
        .lean({ virtuals: true });
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
