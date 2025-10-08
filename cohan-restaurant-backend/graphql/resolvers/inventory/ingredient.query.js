import mongoose from "mongoose";
import { Ingredient } from "../../../models/index.js";

export default {
  ingredients: async (_p, { restaurantId, search, limit }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    const q = { restaurantId, isActive: true };
    if (search?.trim()) {
      q.$or = [
        { name: new RegExp(search.trim(), "i") },
        { sku: new RegExp(search.trim(), "i") },
        { category: new RegExp(search.trim(), "i") },
      ];
    }
    return Ingredient.find(q)
      .sort({ name: 1 })
      .limit(Math.min(limit ?? 100, 500))
      .lean({ virtuals: true });
  },
  ingredient: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return null;
    return Ingredient.findById(id).lean({ virtuals: true });
  },
};
