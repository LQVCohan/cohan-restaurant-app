import mongoose from "mongoose";
import { Ingredient } from "../../../models/index.js";

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default {
  ingredients: async (_p, { restaurantId, search, limit }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const q = { restaurantId, isActive: true };

    if (search?.trim()) {
      const pattern = escapeRegex(search.trim());
      const rx = new RegExp(pattern, "i");
      q.$or = [{ name: rx }, { sku: rx }, { category: rx }];
    }

    return Ingredient.find(q)
      .sort({ name: 1 })
      .limit(Math.min(limit ?? 100, 500))
      .select({ __v: 0 })
      .lean({ virtuals: true });
  },

  ingredient: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return null;

    return Ingredient.findById(id).select({ __v: 0 }).lean({ virtuals: true });
  },
};
