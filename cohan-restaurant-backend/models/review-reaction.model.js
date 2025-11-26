// cohan-restaurant-backend/models/review-reaction.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

export const ReviewReactionTypes = Object.freeze([
  "like",
  "love",
  "care",
  "haha",
  "wow",
  "sad",
  "angry",
]);

const ReviewReactionSchema = BaseSchemaModel(
  {
    // Review nào?
    reviewId: {
      type: Types.ObjectId,
      ref: "Review",
      required: true,
      index: true,
    },

    // Nhà hàng nào? (để lọc/report nhanh theo restaurant)
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

    // Loại reaction: like/love/haha...
    type: {
      type: String,
      enum: ReviewReactionTypes,
      required: true,
      index: true,
    },
  },
  {
    // đã có timestamps, virtuals, leanVirtuals trong BaseSchemaModel
  }
);

// Mỗi user chỉ có 1 reaction cho 1 review
ReviewReactionSchema.index({ reviewId: 1, userId: 1 }, { unique: true });

// Optional: index phụ để report
ReviewReactionSchema.index({ restaurantId: 1, type: 1 });
ReviewReactionSchema.index({ userId: 1, type: 1 });

// Helper static tương tự EventLog.log (nếu muốn dùng nhanh)
ReviewReactionSchema.statics.setReaction = async function ({
  reviewId,
  restaurantId,
  userId,
  type,
}) {
  if (!ReviewReactionTypes.includes(type)) {
    throw new Error("Invalid review reaction type");
  }

  // upsert: nếu chưa có -> tạo, có rồi -> đổi type
  const doc = await this.findOneAndUpdate(
    { reviewId, userId },
    { reviewId, restaurantId, userId, type },
    { new: true, upsert: true }
  );

  return doc;
};

// Guard khi reload (dev/hot-reload)
const ReviewReaction =
  mongoose.models.ReviewReaction ||
  mongoose.model("ReviewReaction", ReviewReactionSchema);

export default ReviewReaction;
