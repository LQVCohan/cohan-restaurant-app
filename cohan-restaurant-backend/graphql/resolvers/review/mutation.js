// src/graphql/reviews/review.mutation.js
import { Review, ReviewReaction } from "../../../models/index.js";

import { logReviewEvent } from "../../../utils/logReview.js";

const VALID_REACTIONS = ["like", "love", "care", "haha", "wow", "sad", "angry"];

export default {
  createReview: async (_, { input }, ctx) => {
    const created = await Review.create({
      ...input,
      status: "pending",
      createdBy: ctx?.user?.id || null,
    });

    await logReviewEvent({
      review: created,
      verb: "review.create",
      ctx,
      meta: { rating: created.rating },
    });

    return created;
  },

  updateReview: async (_, { id, input }, ctx) => {
    const before = await Review.findById(id);
    if (!before) throw new Error("Review not found");

    const updated = await Review.findByIdAndUpdate(
      id,
      {
        ...input,
        updatedBy: ctx?.user?.id || null,
      },
      { new: true }
    );

    await logReviewEvent({
      review: updated,
      verb: "review.update",
      ctx,
      diff: {
        before: {
          rating: before.rating,
          title: before.title,
          content: before.content,
          status: before.status,
        },
        after: {
          rating: updated.rating,
          title: updated.title,
          content: updated.content,
          status: updated.status,
        },
      },
    });

    return updated;
  },

  deleteReview: async (_, { id }, ctx) => {
    const review = await Review.findById(id);
    if (!review) return false;

    await Review.findByIdAndDelete(id);

    await logReviewEvent({
      review,
      verb: "review.delete",
      ctx,
      diff: { deletedId: id },
    });

    return true;
  },

  setReviewStatus: async (_, { id, status }, ctx) => {
    const before = await Review.findById(id);
    if (!before) throw new Error("Review not found");

    const updated = await Review.findByIdAndUpdate(
      id,
      { status, updatedBy: ctx?.user?.id || null },
      { new: true }
    );

    await logReviewEvent({
      review: updated,
      verb: "review.status",
      ctx,
      diff: { from: before.status, to: status },
    });

    return updated;
  },

  incrementReviewHelpful: async (_, { id }, ctx) => {
    const updated = await Review.findByIdAndUpdate(
      id,
      {
        $inc: { helpfulCount: 1 },
        updatedBy: ctx?.user?.id || null,
      },
      { new: true }
    );

    await logReviewEvent({
      review: updated,
      verb: "review.helpful",
      ctx,
      meta: { helpfulCount: updated.helpfulCount },
    });

    return updated;
  },

  reactReview: async (_, { id, reaction }, ctx) => {
    const userId = ctx?.user?.id;
    if (!userId) throw new Error("Login required");

    const key = reaction.toLowerCase();
    if (!VALID_REACTIONS.includes(key)) {
      throw new Error("Invalid reaction");
    }

    const review = await Review.findById(id);
    if (!review) throw new Error("Review not found");

    const existing = await ReviewReaction.findOne({ reviewId: id, userId });

    let inc = {};
    let dec = {};
    let action = "set";

    if (!existing) {
      // Add
      await ReviewReaction.create({
        reviewId: id,
        restaurantId: review.restaurantId,
        userId,
        type: key,
        createdBy: userId,
      });
      inc[key] = 1;
    } else if (existing.type === key) {
      // Remove
      await ReviewReaction.deleteOne({ _id: existing._id });
      dec[key] = 1;
      action = "unset";
    } else {
      // Change
      await ReviewReaction.findByIdAndUpdate(existing._id, {
        type: key,
        updatedBy: userId,
      });
      dec[existing.type] = 1;
      inc[key] = 1;
      action = "change";
    }

    const update = {};
    Object.entries(inc).forEach(([k, v]) => (update[`reactions.${k}`] = v));
    Object.entries(dec).forEach(([k, v]) => (update[`reactions.${k}`] = -v));

    const updated = await Review.findByIdAndUpdate(
      id,
      { $inc: update, updatedBy: userId },
      { new: true }
    );

    await logReviewEvent({
      review: updated,
      verb: "review.react",
      ctx,
      meta: { reaction: key, action },
      diff: { inc, dec },
    });

    return updated;
  },
};
