// cohan-restaurant-backend/models/review-comment-reaction.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

export const ReviewCommentReactionTypes = Object.freeze([
  "like",
  "love",
  "care",
  "haha",
  "wow",
  "sad",
  "angry",
]);

const ReviewCommentReactionSchema = BaseSchemaModel(
  {
    // Comment nào?
    commentId: {
      type: Types.ObjectId,
      ref: "ReviewComment",
      required: true,
      index: true,
    },

    // Thuộc review nào (để tiện join/report)
    reviewId: {
      type: Types.ObjectId,
      ref: "Review",
      required: true,
      index: true,
    },

    // Nhà hàng nào?
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },

    // Ai react?
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Loại reaction
    type: {
      type: String,
      enum: ReviewCommentReactionTypes,
      required: true,
      index: true,
    },
  },
  {
    // BaseSchemaModel đã set timestamps/virtuals
  }
);

// Mỗi user chỉ được 1 reaction trên 1 comment
ReviewCommentReactionSchema.index(
  { commentId: 1, userId: 1 },
  { unique: true }
);

// Index phụ để thống kê nhanh
ReviewCommentReactionSchema.index({ restaurantId: 1, type: 1 });
ReviewCommentReactionSchema.index({ userId: 1, type: 1 });

// Helper static giống ReviewReaction (tuỳ em có dùng hay không)
ReviewCommentReactionSchema.statics.setReaction = async function ({
  commentId,
  reviewId,
  restaurantId,
  userId,
  type,
}) {
  if (!ReviewCommentReactionTypes.includes(type)) {
    throw new Error("Invalid review comment reaction type");
  }

  const doc = await this.findOneAndUpdate(
    { commentId, userId },
    { commentId, reviewId, restaurantId, userId, type },
    { new: true, upsert: true }
  );

  return doc;
};

const ReviewCommentReaction =
  mongoose.models.ReviewCommentReaction ||
  mongoose.model("ReviewCommentReaction", ReviewCommentReactionSchema);

export default ReviewCommentReaction;
