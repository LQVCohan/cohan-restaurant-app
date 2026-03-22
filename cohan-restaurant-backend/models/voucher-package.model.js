import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const VoucherPackageSchema = new Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: String,
    voucherIds: [{ type: Types.ObjectId, ref: "Coupon" }],
    startAt: Date,
    endAt: Date,
    publishAt: Date,
    isActive: { type: Boolean, default: true },
    conditions: [{ type: String }],
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", default: null },
  },
  { timestamps: true }
);

VoucherPackageSchema.index({ code: 1 }, { unique: true });

export default model("VoucherPackage", VoucherPackageSchema);
