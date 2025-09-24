import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const AddressSchema = new Schema(
  {
    label: String,
    line1: String,
    line2: String,
    ward: String,
    district: String,
    city: String,
  },
  { _id: false }
);

const CustomerProfileSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User" },
    name: String,
    email: { type: String, lowercase: true, trim: true },
    phone: String,
    addresses: [AddressSchema],
    preferences: Schema.Types.Mixed,
  },
  baseOptions
);

CustomerProfileSchema.index({ phone: 1 }, { sparse: true });

export default mongoose.model("CustomerProfile", CustomerProfileSchema);
