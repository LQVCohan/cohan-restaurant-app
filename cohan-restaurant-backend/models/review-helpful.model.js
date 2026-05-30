import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
const { Schema, Types } = mongoose;
const ReviewHelpfulSchema = BaseSchemaModel({
  reviewId: { type: Types.ObjectId, ref: "Review", required: true, index: true },
  restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
});
ReviewHelpfulSchema.index({ reviewId: 1, userId: 1 }, { unique: true });
export default mongoose.models.ReviewHelpful || mongoose.model("ReviewHelpful", ReviewHelpfulSchema);
