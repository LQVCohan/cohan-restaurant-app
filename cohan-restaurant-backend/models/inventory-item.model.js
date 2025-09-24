import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const baseOptions = { timestamps: true };

const InventoryItemSchema = new Schema(
  {
    restaurantId: { type: Types.ObjectId, ref: "Restaurant", required: true },
    ingredientId: { type: Types.ObjectId, ref: "Ingredient", required: true },
    onHand: { type: Number, default: 0 },
    reserved: { type: Number, default: 0 },
    reorderLevel: { type: Number, default: 0 },
  },
  baseOptions
);

InventoryItemSchema.index(
  { restaurantId: 1, ingredientId: 1 },
  { unique: true }
);

export default mongoose.model("InventoryItem", InventoryItemSchema);
