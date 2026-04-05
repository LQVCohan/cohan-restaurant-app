import mongoose from "mongoose";
import { IngredientCategory } from "../../../models/index.js";

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default {
  ingredientCategories: async (
    _p,
    { restaurantId, search, includeInactive = false, limit = 200 },
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const q = { restaurantId };
    if (!includeInactive) q.isActive = true;
    if (search?.trim()) {
      q.name = new RegExp(escapeRegex(search.trim()), "i");
    }

    return IngredientCategory.find(q)
      .sort({ usageCount: -1, name: 1 })
      .limit(Math.min(limit ?? 200, 500))
      .lean({ virtuals: true });
  },
};
