import mongoose from "mongoose";

import { StockItem, Ingredient } from "../../../models/index.js";

export default {
  stockItems: async (
    _p,
    { restaurantId, warehouseId, ingredientIds, lowOnly, limit }
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    const q = { restaurantId };
    if (warehouseId && mongoose.isValidObjectId(warehouseId))
      q.warehouseId = warehouseId;
    if (ingredientIds?.length)
      q.ingredientId = { $in: ingredientIds.filter(mongoose.isValidObjectId) };

    const list = await StockItem.find(q)
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit ?? 200, 1000))
      .lean({ virtuals: true });

    if (lowOnly) {
      // join minStock nhẹ bằng 2 bước
      const ingMap = new Map();
      const ingredients = await Ingredient.find({
        _id: { $in: list.map((s) => s.ingredientId) },
      })
        .select({ _id: 1, minStock: 1 })
        .lean();
      ingredients.forEach((i) => ingMap.set(String(i._id), i.minStock ?? 0));
      return list.filter(
        (s) => (s.onHand ?? 0) <= (ingMap.get(String(s.ingredientId)) ?? 0)
      );
    }

    return list;
  },
};
