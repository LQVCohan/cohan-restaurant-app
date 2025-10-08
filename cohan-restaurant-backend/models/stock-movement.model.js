import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

export const MovementTypeEnum = [
  "inbound",
  "outbound",
  "adjustment",
  "transfer",
];

const StockMovementSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Warehouse",
    required: true,
    index: true,
  },
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ingredient",
    required: true,
    index: true,
  },
  type: { type: String, enum: MovementTypeEnum, required: true, index: true },
  qty: { type: Number, required: true }, // +/- (theo baseUnit)
  reason: { type: String }, // "order:xxx", "receive:POxxx"...
  meta: { type: Object, default: {} },
});

export default mongoose.model("StockMovement", StockMovementSchema);
