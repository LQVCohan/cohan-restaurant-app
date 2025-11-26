// src/graphql/reviewCommentReaction/reviewCommentReaction.mutation.js

import ReviewCommentReaction, {
  ReviewCommentReactionTypes,
} from "../../../models/review-comment-reaction.model.js";

import { ReviewComment, EventLog } from "../../../models/index.js";
export default {
  // React vào comment: like/love/care/haha/wow/sad/angry
  reactReviewComment: async (_, { id, reaction }, ctx) => {
    const userId = ctx?.user?.id;
    if (!userId) {
      throw new Error("Authentication required");
    }

    const key = String(reaction || "").toLowerCase();
    if (!ReviewCommentReactionTypes.includes(key)) {
      throw new Error("Invalid reaction type");
    }

    const comment = await ReviewComment.findById(id);
    if (!comment) {
      throw new Error("Comment not found");
    }

    const { restaurantId, reviewId } = comment;

    const existing = await ReviewCommentReaction.findOne({
      commentId: id,
      userId,
    });

    let inc = {};
    let dec = {};
    let action = "set";

    if (!existing) {
      // Tạo mới
      await ReviewCommentReaction.create({
        commentId: id,
        reviewId,
        restaurantId,
        userId,
        type: key,
        createdBy: userId,
      });
      inc[key] = 1;
    } else if (existing.type === key) {
      // Bấm lại cùng reaction -> bỏ reaction
      await ReviewCommentReaction.deleteOne({ _id: existing._id });
      dec[key] = 1;
      action = "unset";
    } else {
      // Đổi reaction
      await ReviewCommentReaction.findByIdAndUpdate(existing._id, {
        type: key,
        updatedBy: userId,
      });
      dec[existing.type] = 1;
      inc[key] = 1;
      action = "change";
    }

    // Build $inc cho summary reactions trên comment
    const incPayload = {};
    Object.entries(inc).forEach(([k, v]) => {
      incPayload[`reactions.${k}`] = (incPayload[`reactions.${k}`] || 0) + v;
    });
    Object.entries(dec).forEach(([k, v]) => {
      incPayload[`reactions.${k}`] = (incPayload[`reactions.${k}`] || 0) - v;
    });

    // Nếu muốn likesCount chỉ track 'like'
    if (inc.like) {
      incPayload.likesCount = (incPayload.likesCount || 0) + inc.like;
    }
    if (dec.like) {
      incPayload.likesCount = (incPayload.likesCount || 0) - dec.like;
    }

    const updated = await ReviewComment.findByIdAndUpdate(
      id,
      {
        $inc: incPayload,
        updatedBy: userId,
      },
      { new: true }
    ).lean({ virtuals: true });

    // Log Event
    try {
      await EventLog.log({
        restaurantId,
        verb: "review.comment.react",
        actorUserId: userId,
        object: {
          kind: "ReviewComment",
          id,
          code: updated.id,
        },
        target: {
          kind: "Review",
          id: reviewId,
          code: String(reviewId),
        },
        source: "web",
        status: "success",
        meta: {
          reaction: key,
          action,
        },
        diff: {
          inc,
          dec,
        },
      });
    } catch (err) {
      console.error("EventLog review.comment.react error:", err.message);
    }

    return updated;
  },
};
