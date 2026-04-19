// src/graphql/resolvers/supply/query.js
import mongoose from "mongoose";
import { Supply, StockItem } from "../../../models/index.js";
import { listSupplyCategories, suggestSupplyCategory } from "./category-ai.js";

function makeSupplyWithStock(s, stockItem) {
  // luôn đảm bảo có id (string) cho stockItem trả về
  if (stockItem) {
    return {
      ...s,
      stockItem: {
        // ưu tiên id virtual → _id → fallback supplyId
        id: stockItem.id || String(stockItem._id || s._id),
        restaurantId: stockItem.restaurantId ?? s.restaurantId,
        warehouseId: stockItem.warehouseId ?? null,
        ingredientId: stockItem.ingredientId ?? null,
        // luôn gắn supplyId
        supplyId: stockItem.supplyId
          ? String(stockItem.supplyId)
          : String(s._id),
        onHand: Number(stockItem.onHand || 0),
        reserved: Number(stockItem.reserved || 0),
        batches: Array.isArray(stockItem.batches) ? stockItem.batches : [],
        createdAt: stockItem.createdAt ?? null,
        updatedAt: stockItem.updatedAt ?? null,
      },
    };
  }

  // stockItem “ảo” khi chưa có dữ liệu kho → id = supplyId
  return {
    ...s,
    stockItem: {
      id: String(s._id), // 👈 id lấy theo supplyId
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

export default {
  supplyCategories: async (_p, { restaurantId, search, includeInactive, limit }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    return listSupplyCategories({ restaurantId, search, includeInactive, limit });
  },

  suggestSupplyCategory: async (_p, { restaurantId, name, category }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;
    return suggestSupplyCategory({
      restaurantId,
      supplyName: name,
      existingCategoryName: category,
    });
  },

  // Supply + stockItem (theo warehouse nếu có; nếu không -> tổng across warehouses)
  supplies: async (_p, { restaurantId, warehouseId }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const list = await Supply.find({ restaurantId })
      .select({ __v: 0 })
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    if (!list.length) return [];

    const supplyIds = list.map((s) => s._id);

    const stockFilter = { restaurantId, supplyId: { $in: supplyIds } };
    const hasWarehouse = warehouseId && mongoose.isValidObjectId(warehouseId);
    if (hasWarehouse) {
      stockFilter.warehouseId = warehouseId;
    }

    const stocks = await StockItem.find(stockFilter)
      .select({ __v: 0 })
      .lean({ virtuals: true });

    // supplyId -> [stockItems...]
    const map = new Map();
    for (const st of stocks) {
      const key = String(st.supplyId);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(st);
    }

    return list.map((s) => {
      const arr = map.get(String(s._id)) || [];
      if (!arr.length) {
        // chưa có bất kỳ bản ghi tồn kho
        return makeSupplyWithStock(s, null);
      }

      if (hasWarehouse) {
        // đã filter theo warehouse → lấy bản ghi đầu
        const st = arr[0];
        // đảm bảo id có giá trị
        const concrete = {
          ...st,
          id: st.id || String(st._id || s._id),
          supplyId: st.supplyId ? String(st.supplyId) : String(s._id),
        };
        return makeSupplyWithStock(s, concrete);
      }

      // merge tổng across kho → tạo stockItem “ảo” với id = supplyId
      const onHand = arr.reduce((sum, it) => sum + (it.onHand || 0), 0);
      const reserved = arr.reduce((sum, it) => sum + (it.reserved || 0), 0);
      const merged = {
        id: String(s._id), // 👈 id = supplyId
        restaurantId,
        warehouseId: null,
        ingredientId: null,
        supplyId: String(s._id),
        onHand,
        reserved,
        batches: [], // tổng không gom batch
        createdAt: null,
        updatedAt: null,
      };
      return makeSupplyWithStock(s, merged);
    });
  },

  supply: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return null;
    const s = await Supply.findById(id).lean({ virtuals: true });
    if (!s) return null;

    const stocks = await StockItem.find({ supplyId: id })
      .select({ __v: 0 })
      .lean({ virtuals: true });

    if (!stocks.length) {
      // chưa có tồn → “ảo” với id = supplyId
      return makeSupplyWithStock(s, null);
    }

    // tổng across kho cho 1 supply
    const onHand = stocks.reduce((sum, it) => sum + (it.onHand || 0), 0);
    const reserved = stocks.reduce((sum, it) => sum + (it.reserved || 0), 0);

    return makeSupplyWithStock(s, {
      id: String(s._id), // 👈 id = supplyId
      restaurantId: s.restaurantId,
      warehouseId: null,
      ingredientId: null,
      supplyId: String(s._id),
      onHand,
      reserved,
      batches: [],
      createdAt: null,
      updatedAt: null,
    });
  },
};
