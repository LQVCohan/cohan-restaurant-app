import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const CouponSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    category: { type: String, default: "order" },
    description: String,
    discountType: {
      type: String,
      enum: ["PERCENT", "AMOUNT"],
      default: "PERCENT",
    },
    discountValue: { type: Number, required: true },
    minOrderValue: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
    maxUsage: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    publishAt: Date,
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", default: null },
    constraints: Schema.Types.Mixed,
    startAt: Date,
    endAt: Date,
    isActive: { type: Boolean, default: true },
  },
  baseOptions
);

export default mongoose.model("Coupon", CouponSchema);
