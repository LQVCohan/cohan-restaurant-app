import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const customerFavoriteSchema = BaseSchemaModel({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  targetType: { type: String, enum: ["restaurant", "food"], required: true, index: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
});

customerFavoriteSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
customerFavoriteSchema.index({ userId: 1, createdAt: -1 });

export const CustomerFavorite =
  mongoose.models.CustomerFavorite || mongoose.model("CustomerFavorite", customerFavoriteSchema);

export default CustomerFavorite;
