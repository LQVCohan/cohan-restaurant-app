import mongoose from "mongoose";

const customerAddressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    label: {
      type: String,
      enum: ["home", "office", "other"],
      default: "home",
      trim: true,
    },
    receiverName: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 32 },
    province: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    ward: { type: String, required: true, trim: true },
    specificAddress: { type: String, required: true, trim: true, maxlength: 255 },
    fullAddress: { type: String, required: true, trim: true, maxlength: 500 },
    note: { type: String, default: "", trim: true, maxlength: 500 },
    isDefault: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

customerAddressSchema.index({ userId: 1, isDefault: -1, updatedAt: -1 });

customerAddressSchema.pre("save", async function ensureSingleDefault(next) {
  if (!this.isDefault || !this.isModified("isDefault")) return next();
  await this.constructor.updateMany(
    { userId: this.userId, _id: { $ne: this._id } },
    { $set: { isDefault: false } },
  );
  return next();
});

customerAddressSchema.set("toJSON", { virtuals: true });
customerAddressSchema.set("toObject", { virtuals: true });

export default mongoose.models.CustomerAddress ||
  mongoose.model("CustomerAddress", customerAddressSchema);
