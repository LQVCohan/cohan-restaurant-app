// src/models/recipe.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const IngredientSchema = new mongoose.Schema(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    name: { type: String },
    quantify: { type: Number, default: 1 },
    wastePct: { type: Number, default: 0 }, // % hao hụt 0..100
  },
  { _id: true }
);

// ✅ NEW: ServingVariant cho phép cùng món dùng cả PORTION và BY_WEIGHT
const ServingVariantSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true }, // "portion" | "byWeight"
    mode: { type: String, enum: ["PORTION", "BY_WEIGHT"], required: true },
    yieldQty: { type: Number, required: true, default: 1 },
    yieldUnit: { type: String, required: true, default: "portion" }, // "portion" | "100g" | "g"
    name: { type: String }, // optional: variant theo cách chế biến
    Ingredients: { type: [IngredientSchema], default: [] },
  },
  { _id: true }
);

const RecipeSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
  },

  // ✅ NEW
  servingVariants: { type: [ServingVariantSchema], default: [] },

  notes: { type: String },
  isActive: { type: Boolean, default: true },
});
RecipeSchema.index({ restaurantId: 1, menuItemId: 1 }, { unique: true });

export default mongoose.model("Recipe", RecipeSchema);
