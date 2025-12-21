// src/models/stockItem.js (RECOMMENDED FINAL)
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const BatchSchema = new mongoose.Schema(
  {
    lot: { type: String },
    qty: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Batch.qty must be an integer in ingredient.baseUnit",
      },
    },
    expiry: { type: Date },
    costPerBaseUnit: { type: Number, default: 0 },
  },
  { _id: false } // ✅ value-object batch
);

const StockItemSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  warehouseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Warehouse",
    required: true,
  },
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ingredient",
    required: true,
  },

  onHand: {
    type: Number,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: "onHand must be an integer in ingredient.baseUnit",
    },
  },
  reserved: {
    type: Number,
    default: 0,
    validate: {
      validator: Number.isInteger,
      message: "reserved must be an integer in ingredient.baseUnit",
    },
  },
  batches: { type: [BatchSchema], default: [] },
});

StockItemSchema.index(
  { restaurantId: 1, warehouseId: 1, ingredientId: 1 },
  { unique: true }
);
// optional nếu bạn hay sort updatedAt
StockItemSchema.index({ restaurantId: 1, warehouseId: 1, updatedAt: -1 });

export default mongoose.model("StockItem", StockItemSchema);
