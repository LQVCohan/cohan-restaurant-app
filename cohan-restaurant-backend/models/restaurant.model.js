import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const RestaurantSchema = new Schema(
  {
    ownerId: { type: Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    code: { type: String, unique: true, sparse: true },
    address: {
      line1: String,
      line2: String,
      ward: String,
      district: String,
      city: String,
      country: String,
    },
    geo: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: [Number],
    },
    openHours: [
      {
        day: Number,
        open: String,
        close: String,
      },
    ],
    manager: { type: Types.ObjectId, ref: "User" },
  },
  baseOptions
);

RestaurantSchema.index({ geo: "2dsphere" });

export default mongoose.model("Restaurant", RestaurantSchema);
