import mongoose from "mongoose";
import { Supply, StockItem } from "../../../models/index.js";
import { listSupplyCategories, suggestSupplyCategory } from "./category-ai.js";
import { requireRestaurantAccess } from "../../guards.js";
import {
  getOrderableSupplyCatalogItem,
  listOrderableSupplyCatalogItems,
} from "../../../src/services/orderableSupplyCatalog.service.js";

const ACTIVE_SUPPLY_FILTER = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };

function makeSupplyWithStock(s, stockItem) {
  if (stockItem) {
    return {
      ...s,
      stockItem: {
        id: stockItem.id || String(stockItem._id || s._id),
        restaurantId: stockItem.restaurantId ?? s.restaurantId,
        warehouseId: stockItem.warehouseId ?? null,
        ingredientId: stockItem.ingredientId ?? null,
        supplyId: stockItem.supplyId ? String(stockItem.supplyId) : String(s._id),
        onHand: Number(stockItem.onHand || 0),
        reserved: Number(stockItem.reserved || 0),
        batches: Array.isArray(stockItem.batches) ? stockItem.batches : [],
        createdAt: stockItem.createdAt ?? null,
        updatedAt: stockItem.updatedAt ?? null,
      },
    };
  }

  return {
    ...s,
    stockItem: {
      id: String(s._id),
      restaurantId: s.restaurantId,
      warehouseId: null,
      ingredientId: null,
      supplyId: String(s._id),
      onHand: 0,
      reserved: 0,
      batches: [],
      createdAt: null,
      updatedAt: null,
    },
  };
}

async function listWithStock({ restaurantId, warehouseId, supplyFilter, limit = 0 }) {
  const q = Supply.find({ restaurantId, ...supplyFilter })
    .select({ __v: 0 })
    .sort({ deletedAt: -1, createdAt: -1 })
    .lean({ virtuals: true });
  if (limit > 0) q.limit(limit);

  const list = await q;
  if (!list.length) return [];

  const supplyIds = list.map((s) => s._id);
  const stockFilter = { restaurantId, supplyId: { $in: supplyIds } };
  const hasWarehouse = warehouseId && mongoose.isValidObjectId(warehouseId);
  if (hasWarehouse) stockFilter.warehouseId = warehouseId;

  const stocks = await StockItem.find(stockFilter).select({ __v: 0 }).lean({ virtuals: true });
  const map = new Map();
  for (const st of stocks) {
    const key = String(st.supplyId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(st);
  }

  return list.map((s) => {
    const arr = map.get(String(s._id)) || [];
    if (!arr.length) return makeSupplyWithStock(s, null);

    if (hasWarehouse) {
      const st = arr[0];
      return makeSupplyWithStock(s, {
        ...st,
        id: st.id || String(st._id || s._id),
        supplyId: st.supplyId ? String(st.supplyId) : String(s._id),
      });
    }

    return makeSupplyWithStock(s, {
      id: String(s._id),
      restaurantId,
      warehouseId: null,
      ingredientId: null,
      supplyId: String(s._id),
      onHand: arr.reduce((sum, it) => sum + (it.onHand || 0), 0),
      reserved: arr.reduce((sum, it) => sum + (it.reserved || 0), 0),
      batches: [],
      createdAt: null,
      updatedAt: null,
    });
  });
}

export default {
  orderableSupplies: async (
    _p,
    { restaurantId, warehouseId, search, includeOutOfStock = false },
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    return listOrderableSupplyCatalogItems({
      restaurantId,
      warehouseId,
      search,
      includeOutOfStock,
    });
  },

  orderableSupply: async (
    _p,
    { restaurantId, supplyId, warehouseId, includeOutOfStock = false },
  ) => {
    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(supplyId)
    ) {
      return null;
    }
    return getOrderableSupplyCatalogItem({
      restaurantId,
      supplyId,
      warehouseId,
      includeOutOfStock,
    });
  },

  supplyCategories: async (_p, { restaurantId, search, includeInactive, limit }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);
    return listSupplyCategories({ restaurantId, search, includeInactive, limit });
  },

  suggestSupplyCategory: async (_p, { restaurantId, name, category }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;
    await requireRestaurantAccess(ctx, restaurantId);
    return suggestSupplyCategory({ restaurantId, supplyName: name, existingCategoryName: category });
  },

  supplies: async (_p, { restaurantId, warehouseId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);
    return listWithStock({ restaurantId, warehouseId, supplyFilter: ACTIVE_SUPPLY_FILTER });
  },

  supplyTrash: async (_p, { restaurantId, warehouseId, limit = 200 }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);
    return listWithStock({
      restaurantId,
      warehouseId,
      supplyFilter: { deletedAt: { $ne: null } },
      limit: Math.min(Math.max(Number(limit) || 200, 1), 500),
    });
  },

  supply: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return null;
    const s = await Supply.findOne({ _id: id, ...ACTIVE_SUPPLY_FILTER }).lean({ virtuals: true });
    if (!s) return null;
    await requireRestaurantAccess(ctx, s.restaurantId);

    const stocks = await StockItem.find({ supplyId: id }).select({ __v: 0 }).lean({ virtuals: true });
    if (!stocks.length) return makeSupplyWithStock(s, null);

    return makeSupplyWithStock(s, {
      id: String(s._id),
      restaurantId: s.restaurantId,
      warehouseId: null,
      ingredientId: null,
      supplyId: String(s._id),
      onHand: stocks.reduce((sum, it) => sum + (it.onHand || 0), 0),
      reserved: stocks.reduce((sum, it) => sum + (it.reserved || 0), 0),
      batches: [],
      createdAt: null,
      updatedAt: null,
    });
  },
};
