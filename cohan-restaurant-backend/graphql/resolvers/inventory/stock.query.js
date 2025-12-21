// src/graphql/resolvers/inventory/stockItem.query.js
import mongoose from "mongoose";
import { StockItem, Ingredient } from "../../../models/index.js";

export default {
  stockItems: async (
    _p,
    { restaurantId, warehouseId, ingredientIds, lowOnly, limit }
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const q = { restaurantId };

    if (warehouseId && mongoose.isValidObjectId(warehouseId)) {
      q.warehouseId = warehouseId;
    }

    if (ingredientIds?.length) {
      const ids = ingredientIds.filter(mongoose.isValidObjectId);
      if (!ids.length) return [];
      q.ingredientId = { $in: ids };
    }

    const list = await StockItem.find(q)
      .select({ __v: 0 })
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit ?? 200, 1000))
      .lean({ virtuals: true });

    if (!lowOnly) return list;
    if (!list.length) return [];

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
  },
};
