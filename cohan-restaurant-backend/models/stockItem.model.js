// src/models/stockItem.js (RECOMMENDED FINAL)
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const BatchSchema = new mongoose.Schema(
  {
    lot: { type: String },
    qty: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: isFiniteNumber,
        message: "Batch.qty must be a finite number in the item base unit",
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
  // Một stock item có thể thuộc nguyên liệu HOẶC supply
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ingredient",
    required: false,
  },
  supplyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Supply",
    required: false,
  },

  onHand: {
    type: Number,
    default: 0,
    validate: {
      validator: isFiniteNumber,
      message: "onHand must be a finite number in the item base unit",
    },
  },
  reserved: {
    type: Number,
    default: 0,
    validate: {
      validator: isFiniteNumber,
      message: "reserved must be a finite number in the item base unit",
    },
  },

  // Giá vốn & giá bán tại thời điểm nhập kho (ưu tiên cho Supply)
  costPerUnit: { type: Number, default: 0 },
  pricePerUnit: { type: Number, default: 0 },

  note: { type: String, trim: true },
  batches: { type: [BatchSchema], default: [] },
});

// Đảm bảo ít nhất một trong ingredientId/supplyId được set
StockItemSchema.pre("validate", function (next) {
  if (!this.ingredientId && !this.supplyId) {
    next(new Error("Either ingredientId or supplyId is required"));
    return;
  }
  next();
});

// Unique theo ingredient (partial) và theo supply (partial)
StockItemSchema.index(
  { restaurantId: 1, warehouseId: 1, ingredientId: 1 },
  {
    unique: true,
    partialFilterExpression: { ingredientId: { $exists: true, $ne: null } },
  }
);
StockItemSchema.index(
  { restaurantId: 1, warehouseId: 1, supplyId: 1 },
  {
    unique: true,
    partialFilterExpression: { supplyId: { $exists: true, $ne: null } },
  }
);
// optional nếu bạn hay sort updatedAt
StockItemSchema.index({ restaurantId: 1, warehouseId: 1, updatedAt: -1 });

export default mongoose.model("StockItem", StockItemSchema);
