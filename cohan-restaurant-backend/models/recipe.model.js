import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const IngredientSchema = new mongoose.Schema(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    quantify: { type: Number, default: 1 },
    wastePct: { type: Number, default: 0 },
  },
  { _id: true }
);

const ServingVariantSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    mode: { type: String, enum: ["PORTION", "BY_WEIGHT"], required: true },
    yieldQty: { type: Number, required: true, default: 1 },
    yieldUnit: { type: String, required: true, default: "portion" },
    name: { type: String },
    Ingredients: { type: [IngredientSchema], default: [] },
    price: { type: Number, default: 0 },
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
  servingVariants: { type: [ServingVariantSchema], default: [] },
  notes: { type: String },
  isActive: { type: Boolean, default: true },
});

RecipeSchema.index({ restaurantId: 1, menuItemId: 1 }, { unique: true });

export default mongoose.model("Recipe", RecipeSchema);
