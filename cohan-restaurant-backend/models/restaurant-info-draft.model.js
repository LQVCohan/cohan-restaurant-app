import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const restaurantInfoDraftSchema = BaseSchemaModel({
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  source: {
    type: String,
    enum: ["manual", "auto_network_fallback", "auto_before_exit"],
    default: "manual",
    index: true,
  },
});

restaurantInfoDraftSchema.index({ managerId: 1, restaurantId: 1, updatedAt: -1 });

export const RestaurantInfoDraft =
  mongoose.models.RestaurantInfoDraft ||
  mongoose.model("RestaurantInfoDraft", restaurantInfoDraftSchema);

export default RestaurantInfoDraft;
