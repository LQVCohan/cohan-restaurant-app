import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const baseOptions = { timestamps: true };

const PromotionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true },
    description: String,
    promotionType: {
      type: String,
      enum: ["PERCENTAGE", "FIXED", "BOGO", "COMBO", "FREESHIP"],
      default: "PERCENTAGE",
    },
    scope: {
      type: String,
      enum: ["ORDER", "CATEGORY", "ITEM"],
      default: "ORDER",
    },
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    categoryId: { type: Types.ObjectId, ref: "Category" },
    itemId: { type: Types.ObjectId, ref: "MenuItem" },
    giftItemId: { type: Types.ObjectId, ref: "MenuItem", default: null },
    discountType: {
      type: String,
      enum: ["PERCENT", "AMOUNT"],
      default: "PERCENT",
    },
    discountValue: { type: Number, required: true, min: 0 },
    buyQuantity: { type: Number, default: 0, min: 0 },
    getQuantity: { type: Number, default: 0, min: 0 },
    comboItems: [
      {
        itemId: { type: Types.ObjectId, ref: "MenuItem", required: true },
        quantity: { type: Number, default: 1, min: 1 },
      },
    ],
    minOrderValue: { type: Number, default: 0, min: 0 },
    maxDiscount: { type: Number, default: 0, min: 0 },
    usageLimit: { type: Number, default: 0, min: 0 },
    usageCount: { type: Number, default: 0, min: 0 },
    targetAudience: { type: String, default: "all" },
    conditions: [{ type: String }],
    startAt: Date,
    endAt: Date,
    isActive: { type: Boolean, default: true },
    stacking: { type: Boolean, default: false },
    level: {
      type: Number,
      min: 1,
      max: 3,
      default: 1,
    },
  },
  baseOptions,
);

const activeCapacityFilter = {
  $expr: {
    $or: [
      { $lte: [{ $ifNull: ["$usageLimit", 0] }, 0] },
      {
        $lt: [
          { $ifNull: ["$usageCount", 0] },
          { $ifNull: ["$usageLimit", 0] },
        ],
      },
    ],
  },
};

export const withActivePromotionCapacity = (filter = {}) =>
  filter?.isActive === true
    ? { $and: [filter, activeCapacityFilter] }
    : filter;

function enforceActiveCapacity(next) {
  this.setQuery(withActivePromotionCapacity(this.getFilter()));
  return next();
}

PromotionSchema.pre("find", enforceActiveCapacity);
PromotionSchema.pre("findOne", enforceActiveCapacity);
PromotionSchema.index({ restaurantId: 1, isActive: 1, startAt: 1, endAt: 1 });

export default mongoose.model("Promotion", PromotionSchema);
