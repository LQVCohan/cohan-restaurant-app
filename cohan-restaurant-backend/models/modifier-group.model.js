import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const ModifierGroupSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    name: { type: String, required: true },
    required: { type: Boolean, default: false },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
  },
  baseOptions
);

export default mongoose.model("ModifierGroup", ModifierGroupSchema);
