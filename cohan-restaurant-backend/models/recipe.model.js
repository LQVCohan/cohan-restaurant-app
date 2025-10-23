// src/models/recipe.model.js
import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const ComponentSchema = new mongoose.Schema(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    qty: { type: Number, required: true, min: 0 }, // theo baseUnit của ingredient
    unit: { type: String }, // hiển thị (không dùng để tính)
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
    preparationMethodName: { type: String }, // optional: variant theo cách chế biến
    components: { type: [ComponentSchema], default: [] },
  },
  { _id: true }
);

const RecipeSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
    index: true,
  },

  // Legacy baseline (giữ nguyên để không phá dữ liệu cũ)
  yieldQty: { type: Number, default: 1 },
  yieldUnit: { type: String, default: "portion" },
  baseComponents: { type: [ComponentSchema], default: [] },

  // ✅ NEW
  servingVariants: { type: [ServingVariantSchema], default: [] },

  notes: { type: String },
  isActive: { type: Boolean, default: true, index: true },
});
RecipeSchema.index({ restaurantId: 1, menuItemId: 1 }, { unique: true });

export default mongoose.model("Recipe", RecipeSchema);
