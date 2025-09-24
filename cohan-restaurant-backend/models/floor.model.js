import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const FloorSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    mapImageUrl: String,
  },
  baseOptions
);

FloorSchema.index({ restaurantId: 1, order: 1 });

export default mongoose.model("Floor", FloorSchema);
