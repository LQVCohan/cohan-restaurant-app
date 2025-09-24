import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    description: String,
    discountType: {
      type: String,
      enum: ["PERCENT", "AMOUNT"],
      default: "PERCENT",
    },
    discountValue: { type: Number, required: true },
    maxUsage: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    constraints: Schema.Types.Mixed,
    startAt: Date,
    endAt: Date,
    isActive: { type: Boolean, default: true },
  },
  baseOptions
);

export default mongoose.model("Coupon", CouponSchema);
