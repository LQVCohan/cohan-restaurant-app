import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

export const UnitEnum = [
  "g",
  "kg",
  "ml",
  "l",
  "unit",
  "piece",
  "tbsp",
  "tsp",
  "pack",
  "bottle",
  "can",
];

const ConversionSchema = new mongoose.Schema(
  {
    from: { type: String, enum: UnitEnum, required: true },
    to: { type: String, enum: UnitEnum, required: true },
    ratio: { type: Number, required: true, min: 0 }, // 1 from = ratio to
  },
  { _id: false }
);

const IngredientSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true, index: "text" },
  sku: { type: String, trim: true },
  category: { type: String, trim: true },

  baseUnit: { type: String, enum: UnitEnum, required: true, default: "g" },
  conversions: { type: [ConversionSchema], default: [] },

  costPerBaseUnit: { type: Number, default: 0, min: 0 },

  photos: { type: [String], default: [] },
  minStock: { type: Number, default: 0, min: 0 },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
});

IngredientSchema.index({ restaurantId: 1, name: 1 }, { unique: true });
IngredientSchema.index({ restaurantId: 1, createdAt: -1 });
export default mongoose.model("Ingredient", IngredientSchema);
