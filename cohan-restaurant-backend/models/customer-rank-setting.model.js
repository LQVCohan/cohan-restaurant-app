import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

export const DEFAULT_CUSTOMER_RANKS = Object.freeze([
  { name: "Mới", minPoints: 0, benefits: "" },
  { name: "Thân thiết", minPoints: 5, benefits: "Ưu đãi dịp đặc biệt" },
  { name: "VIP", minPoints: 20, benefits: "Ưu tiên đặt bàn" },
]);

const rankThresholdSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    minPoints: { type: Number, required: true, min: 0 },
    benefits: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const customerRankSettingSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  ranks: {
    type: [rankThresholdSchema],
    default: () => DEFAULT_CUSTOMER_RANKS.map((rank) => ({ ...rank })),
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

customerRankSettingSchema.index({ restaurantId: 1 }, { unique: true });

export const CustomerRankSetting =
  mongoose.models.CustomerRankSetting ||
  mongoose.model("CustomerRankSetting", customerRankSettingSchema);
export default CustomerRankSetting;
