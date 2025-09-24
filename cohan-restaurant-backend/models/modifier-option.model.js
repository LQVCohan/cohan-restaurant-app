import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const ModifierOptionSchema = new Schema(
  {
    groupId: { type: Types.ObjectId, ref: "ModifierGroup", required: true },
    name: { type: String, required: true },
    priceDelta: { type: Number, default: 0 },
  },
  baseOptions
);

ModifierOptionSchema.index({ groupId: 1, name: 1 }, { unique: true });

export default mongoose.model("ModifierOption", ModifierOptionSchema);
