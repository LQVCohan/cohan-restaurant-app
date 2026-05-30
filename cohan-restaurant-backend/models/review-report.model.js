import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
const { Schema, Types } = mongoose;
const ReviewReportSchema = BaseSchemaModel({
  reviewId: { type: Types.ObjectId, ref: "Review", required: true, index: true },
  restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true, index: true },
  reporterUserId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  reason: { type: String, enum: ["spam", "abuse", "offensive", "fake", "privacy", "other"], required: true, index: true },
  detail: { type: String, trim: true, default: "" },
  status: { type: String, enum: ["pending", "resolved", "rejected"], default: "pending", index: true },
  resolvedBy: { type: Types.ObjectId, ref: "User", default: null },
  resolvedAt: { type: Date, default: null },
  resolutionNote: { type: String, trim: true, default: "" },
});
ReviewReportSchema.index({ reviewId: 1, reporterUserId: 1, reason: 1 }, { unique: true });
ReviewReportSchema.index({ restaurantId: 1, status: 1, createdAt: -1 });
export default mongoose.models.ReviewReport || mongoose.model("ReviewReport", ReviewReportSchema);
