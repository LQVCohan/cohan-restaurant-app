// src/graphql/resolvers/inventory/stockItem.query.js
import mongoose from "mongoose";
import { StockItem, Ingredient, Supply } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

export default {
  stockItems: async (
    _p,
    { restaurantId, warehouseId, ingredientIds, lowOnly, limit }
  , ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_READ);

    const q = { restaurantId, ingredientId: { $exists: true, $ne: null } };

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

  // StockItem cho Supply (theo schema supply.graphql)
  supplyStockItems: async (_p, { restaurantId, supplyId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_READ);

    const q = { restaurantId, supplyId: { $exists: true, $ne: null } };
    if (supplyId && mongoose.isValidObjectId(supplyId)) {
      q.supplyId = supplyId;
    }

    const items = await StockItem.find(q)
      .select({ __v: 0 })
      .sort({ updatedAt: -1 })
      .lean({ virtuals: true });

    if (!items.length) return [];

    // Gắn minStock từ Supply để FE có thể tính cảnh báo nếu cần
    const ids = items.map((it) => it.supplyId).filter(Boolean);
    const supplies = await Supply.find({ _id: { $in: ids } })
      .select({ _id: 1, minStock: 1, costPerUnit: 1, pricePerUnit: 1, notes: 1 })
      .lean();
    const metaMap = new Map(
      supplies.map((s) => [
        String(s._id),
        {
          minStock: Number(s.minStock) || 0,
          costPerUnit: Number(s.costPerUnit) || 0,
          pricePerUnit: Number(s.pricePerUnit) || 0,
          notes: s.notes || "",
        },
      ])
    );

    return items.map((it) => ({
      ...it,
      minStock: metaMap.get(String(it.supplyId))?.minStock ?? 0,
      costPerUnit:
        it.costPerUnit ?? metaMap.get(String(it.supplyId))?.costPerUnit ?? 0,
      pricePerUnit:
        it.pricePerUnit ?? metaMap.get(String(it.supplyId))?.pricePerUnit ?? 0,
      note: it.note ?? metaMap.get(String(it.supplyId))?.notes ?? "",
    }));
  },
};
