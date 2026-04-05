import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const IngredientCategorySchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true },
  source: { type: String, enum: ["manual", "sync"], default: "manual" },
  usageCount: { type: Number, default: 0, min: 0 },
  isActive: { type: Boolean, default: true },
});

IngredientCategorySchema.index({ restaurantId: 1, slug: 1 }, { unique: true });
IngredientCategorySchema.index({ restaurantId: 1, name: 1 });

export default mongoose.model("IngredientCategory", IngredientCategorySchema);
