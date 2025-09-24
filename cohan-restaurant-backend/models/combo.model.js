import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const ComboItemSchema = new Schema(
  {
    menuItemId: { type: Types.ObjectId, ref: "MenuItem", required: true },
    qty: { type: Number, default: 1 },
  },
  { _id: false }
);

const ComboSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant" },
    name: { type: String, required: true },
    items: [ComboItemSchema],
    price: { type: Number, required: true },
  },
  baseOptions
);

export default mongoose.model("Combo", ComboSchema);
