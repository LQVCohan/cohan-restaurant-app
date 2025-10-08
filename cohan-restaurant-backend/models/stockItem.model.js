import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const BatchSchema = new mongoose.Schema(
  {
    lot: { type: String }, // mã lô
    qty: { type: Number, required: true, min: 0 }, // theo baseUnit của ingredient
    expiry: { type: Date }, // hạn dùng
    costPerBaseUnit: { type: Number, default: 0 },
  },
  { _id: true, timestamps: true }
);

const StockItemSchema = BaseSchemaModel({
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

  onHand: { type: Number, default: 0 }, // tổng tồn kho (baseUnit)
  reserved: { type: Number, default: 0 }, // đã giữ chỗ (nếu áp dụng)
  batches: { type: [BatchSchema], default: [] },
});
StockItemSchema.index(
  { restaurantId: 1, warehouseId: 1, ingredientId: 1 },
  { unique: true }
);

export default mongoose.model("StockItem", StockItemSchema);
