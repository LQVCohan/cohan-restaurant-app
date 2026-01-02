import mongoose from "mongoose";
import BaseSchemaModel from "./baseSchemaModel.js";

const IngredientRecentSchema = BaseSchemaModel({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Restaurant",
    required: true,
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Ingredient",
    required: true,
    index: true,
  },
  lastUsedAt: { type: Date, default: Date.now, index: true },
  times: { type: Number, default: 1, min: 0 },
});

IngredientRecentSchema.index(
  { restaurantId: 1, userId: 1, ingredientId: 1 },
  { unique: true }
);

IngredientRecentSchema.index({ restaurantId: 1, userId: 1, lastUsedAt: -1 });

export default mongoose.model("IngredientRecent", IngredientRecentSchema);
