import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";
import { UnitEnum } from "./ingredient.model.js";

export const SellUnitEnum = ["portion", "g", "kg"];

const RecipeIngredientLineSchema = new mongoose.Schema(
  {
    ingredientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ingredient",
      required: true,
    },
    qty: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UnitEnum, required: true },
    wastePct: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false }
);

const ServingVariantSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    name: { type: String, trim: true },

    mode: { type: String, enum: ["PORTION", "BY_WEIGHT"], required: true },

    sellQty: { type: Number, default: 1, min: 0.000001 },
    sellUnit: { type: String, enum: SellUnitEnum, default: "portion" },

    ingredients: { type: [RecipeIngredientLineSchema], default: [] },

    price: { type: Number, default: 0, min: 0 },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false } // key là định danh ổn định
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
    index: true,
  },

  servingVariants: { type: [ServingVariantSchema], default: [] },

  notes: { type: String },
  isActive: { type: Boolean, default: true },
  deletedAt: { type: Date, default: null, index: true },
  deleteExpiresAt: { type: Date, default: null, index: true },
});

RecipeSchema.index({ restaurantId: 1, menuItemId: 1 }, { unique: true });
RecipeSchema.index({ restaurantId: 1, updatedAt: -1 });
RecipeSchema.index({ restaurantId: 1, deletedAt: 1, deleteExpiresAt: 1 });
RecipeSchema.pre("validate", function (next) {
  const variants = Array.isArray(this.servingVariants)
    ? this.servingVariants
    : [];

  const keys = variants.map((v) => String(v?.key || "").trim()).filter(Boolean);
  const keySet = new Set(keys);
  if (keySet.size !== keys.length) {
    return next(new Error("servingVariants.key must be unique"));
  }

  const defaultCount = variants.filter((v) => v?.isDefault).length;
  if (defaultCount > 1) {
    return next(new Error("Only one servingVariant can be isDefault=true"));
  }

  for (const v of variants) {
    if (!v) continue;

    if (v.mode === "PORTION" && v.sellUnit !== "portion") {
      return next(
        new Error(`Variant "${v.key}": PORTION must have sellUnit="portion"`)
      );
    }

    if (v.mode === "BY_WEIGHT" && !["kg", "g"].includes(v.sellUnit)) {
      return next(
        new Error(
          `Variant "${v.key}": BY_WEIGHT must have sellUnit "kg" or "g"`
        )
      );
    }
  }

  next();
});

export default mongoose.model("Recipe", RecipeSchema);
