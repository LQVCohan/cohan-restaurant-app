import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const USER_COUPON_STATUSES = ["saved", "used", "expired", "revoked"];

const UserCouponSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    couponId: {
      type: Types.ObjectId,
      ref: "Coupon",
      required: true,
      index: true,
    },
    restaurantId: {
      type: Types.ObjectId,
      ref: "Restaurant",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: USER_COUPON_STATUSES,
      default: "saved",
      index: true,
    },
    savedAt: { type: Date, default: Date.now },
    usedAt: { type: Date, default: null },
    orderId: { type: Types.ObjectId, ref: "Order", default: null },
    invoiceId: { type: Types.ObjectId, ref: "Invoice", default: null },
    discountAmount: { type: Number, default: 0 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

UserCouponSchema.index({ userId: 1, couponId: 1 }, { unique: true });
UserCouponSchema.index({ userId: 1, restaurantId: 1, status: 1, savedAt: -1 });

export { USER_COUPON_STATUSES };
export default mongoose.model("UserCoupon", UserCouponSchema);
