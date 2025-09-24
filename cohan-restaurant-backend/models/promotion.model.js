import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const PromotionSchema = new Schema(
  {
    name: { type: String, required: true },
    description: String,
    scope: {
      type: String,
      enum: ["ORDER", "CATEGORY", "ITEM"],
      default: "ORDER",
    },
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    categoryId: { type: Types.ObjectId, ref: "Category" },
    itemId: { type: Types.ObjectId, ref: "MenuItem" },
    discountType: {
      type: String,
      enum: ["PERCENT", "AMOUNT"],
      default: "PERCENT",
    },
    discountValue: { type: Number, required: true },
    startAt: Date,
    endAt: Date,
    isActive: { type: Boolean, default: true },
    stacking: { type: Boolean, default: false },
  },
  baseOptions
);

export default mongoose.model("Promotion", PromotionSchema);
