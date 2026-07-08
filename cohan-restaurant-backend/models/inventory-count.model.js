import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);

const CountLineSchema = new mongoose.Schema(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    nameSnapshot: { type: String, trim: true, default: "" },
    skuSnapshot: { type: String, trim: true, default: "" },
    unit: { type: String, required: true, trim: true },
    systemQty: {
      type: Number,
      required: true,
      default: 0,
      validate: { validator: isFiniteNumber, message: "systemQty must be finite" },
    },
    countedQty: {
      type: Number,
      default: null,
      validate: {
        validator(value) {
          return value == null || isFiniteNumber(value);
        },
        message: "countedQty must be finite",
      },
    },
    variance: {
      type: Number,
      required: true,
      default: 0,
      validate: { validator: isFiniteNumber, message: "variance must be finite" },
    },
    note: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const CountDocumentSchema = new mongoose.Schema(
  {
    movementId: { type: mongoose.Schema.Types.ObjectId, ref: "StockMovement" },
    documentNo: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["pending", "matched", "mismatch", "missing"],
      default: "pending",
    },
    note: { type: String, trim: true, default: "" },
    checkedAt: { type: Date },
  },
  { _id: false },
);

const InventoryCountSchema = BaseSchemaModel({
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
  code: { type: String, required: true, trim: true, index: true },
  title: { type: String, trim: true, default: "Kiểm kê cuối kỳ" },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  status: {
    type: String,
    enum: ["draft", "closed", "cancelled"],
    default: "draft",
    index: true,
  },
  lines: { type: [CountLineSchema], default: [] },
  documents: { type: [CountDocumentSchema], default: [] },
  note: { type: String, trim: true, default: "" },
  closedAt: { type: Date },
});

InventoryCountSchema.index({ restaurantId: 1, warehouseId: 1, createdAt: -1 });
InventoryCountSchema.index({ restaurantId: 1, code: 1 }, { unique: true });

export default mongoose.model("InventoryCount", InventoryCountSchema);
