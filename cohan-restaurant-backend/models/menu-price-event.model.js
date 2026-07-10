import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const { Schema, Types } = mongoose;

const VariantPriceSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const PriceEventItemSchema = new Schema(
  {
    recipeId: { type: Types.ObjectId, ref: "Recipe", required: true },
    menuItemId: { type: Types.ObjectId, ref: "MenuItem", required: true },
    beforePrices: { type: [VariantPriceSchema], default: [] },
    appliedPrices: { type: [VariantPriceSchema], default: [] },
  },
  { _id: false },
);

const MenuPriceEventSchema = BaseSchemaModel({
  restaurantId: {
    type: Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  timeSlot: { type: String },
  eventName: { type: String, trim: true, default: "Sự kiện giá tạm thời" },
  restoreAt: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: [
      "scheduled",
      "processing",
      "restored",
      "partially_restored",
      "cancelled",
    ],
    default: "scheduled",
    index: true,
  },
  items: { type: [PriceEventItemSchema], default: [] },
  createdBy: { type: Types.ObjectId, ref: "User" },
  restoredAt: { type: Date },
  restoredVariantCount: { type: Number, default: 0, min: 0 },
  skippedVariantCount: { type: Number, default: 0, min: 0 },
  attempts: { type: Number, default: 0, min: 0 },
  lastError: { type: String },
});

MenuPriceEventSchema.index({ status: 1, restoreAt: 1 });
MenuPriceEventSchema.index({ restaurantId: 1, createdAt: -1 });

export default (
  mongoose.models.MenuPriceEvent ||
  mongoose.model("MenuPriceEvent", MenuPriceEventSchema)
);
