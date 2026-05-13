import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const CouponRedemptionSchema = new Schema(
  {
    couponId: {
      type: Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    userId: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    orderIds: [{ type: Types.ObjectId, ref: "Order" }],
    invoiceId: {
      type: Types.ObjectId,
      ref: "Invoice",
      default: null,
    },
    couponCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    discountAmount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    source: {
      type: String,
      enum: ["customer_checkout", "pos", "staff_order"],
      default: "pos",
    },
    redeemedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

CouponRedemptionSchema.index({ couponId: 1, userId: 1 });
CouponRedemptionSchema.index({ restaurantId: 1, redeemedAt: -1 });
CouponRedemptionSchema.index({ couponCode: 1, restaurantId: 1 });
CouponRedemptionSchema.index({ invoiceId: 1 });
CouponRedemptionSchema.index(
  { invoiceId: 1, couponId: 1 },
  {
    unique: true,
    partialFilterExpression: { invoiceId: { $type: "objectId" } },
  },
);

export default mongoose.model("CouponRedemption", CouponRedemptionSchema);
