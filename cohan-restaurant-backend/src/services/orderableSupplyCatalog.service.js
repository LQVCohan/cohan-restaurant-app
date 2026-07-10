import mongoose from "mongoose";

import { StockItem, Supply } from "../../models/index.js";

const ACTIVE_SUPPLY_FILTER = {
  isActive: { $ne: false },
  pricePerUnit: { $gt: 0 },
  $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
};

const escapeRegex = (value) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const toId = (value) =>
  value && mongoose.isValidObjectId(String(value))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

export const isSupplyCatalogItem = (item) =>
  String(item?.itemType || "").toUpperCase() === "SUPPLY" || Boolean(item?.supplyId);

export function mapSupplyToCatalogItem(supply, stockSummary = {}) {
  const onHand = Math.max(0, toFiniteNumber(stockSummary.onHand));
  const reserved = Math.max(0, toFiniteNumber(stockSummary.reserved));
  const available = Math.max(0, onHand - reserved);
  const minStock = Math.max(0, toFiniteNumber(supply?.minStock));
  const price = Math.round(Math.max(0, toFiniteNumber(supply?.pricePerUnit)));
  const isOutOfStock = available <= 0;
  const isLowStock = !isOutOfStock && minStock > 0 && available <= minStock;
  const unit = String(supply?.unit || "đơn vị").trim() || "đơn vị";
  const category = String(supply?.category || "Đồ uống / supply").trim();
  const stockWarnings = [];

  if (isOutOfStock) {
    stockWarnings.push(`${supply?.name || "Supply"} đã hết tồn kho.`);
  } else if (isLowStock) {
    stockWarnings.push(
      `${supply?.name || "Supply"} chỉ còn ${available} ${unit}.`,
    );
  }

  return {
    _id: supply?._id,
    id: String(supply?._id),
    itemType: "SUPPLY",
    supplyId: String(supply?._id),
    restaurantId: supply?.restaurantId,
    menuId: null,
    categoryId: null,
    code: supply?.sku || null,
    name: supply?.name || "Supply",
    description:
      supply?.notes ||
      `${category || "Nước / supply"} bán trực tiếp từ kho và có ở mọi khung giờ.`,
    sortOrder: 0,
    labels: [category || "Supply", "Luôn bán mọi buổi"],
    foodType: null,
    meatTypes: [],
    dietTags: [],
    allergenTags: [],
    tasteProfile: null,
    basePrice: price,
    defaultServingKey: "unit",
    hasByWeightVariant: false,
    servingVariants: [
      {
        key: "unit",
        name: unit,
        mode: "PORTION",
        sellQty: 1,
        sellUnit: unit,
        price,
        isDefault: true,
      },
    ],
    taxRate: 0,
    servingPortion: 1,
    servingUnit: unit,
    prepStation: "bar",
    printStationId: "bar",
    thumbImage: Array.isArray(supply?.photos) ? supply.photos[0] || null : null,
    mediaAssetIds: [],
    status: isOutOfStock ? "out_of_stock" : "available",
    inventoryStatus: isOutOfStock
      ? "OUT_OF_STOCK"
      : isLowStock
        ? "LOW_STOCK"
        : "IN_STOCK",
    maxAvailable: Math.floor(available),
    stockWarnings,
    stockShortages: [],
    avgPrepTimeMin: 0,
    point: 0,
    rate: 0,
    orderCounter: 0,
    notes: supply?.notes || null,
    createdAt: supply?.createdAt || null,
    updatedAt: supply?.updatedAt || null,
    _supplyCatalog: true,
    _supplyStock: { onHand, reserved, available },
  };
}

async function loadStockSummary({ restaurantId, supplyIds, warehouseId, session }) {
  if (!supplyIds.length) return new Map();

  const filter = {
    restaurantId,
    supplyId: { $in: supplyIds },
  };
  const normalizedWarehouseId = toId(warehouseId);
  if (normalizedWarehouseId) filter.warehouseId = normalizedWarehouseId;

  let query = StockItem.find(filter).select({
    supplyId: 1,
    onHand: 1,
    reserved: 1,
  });
  if (session) query = query.session(session);
  const rows = await query.lean();

  const summaries = new Map();
  for (const row of rows) {
    const key = String(row.supplyId);
    const current = summaries.get(key) || { onHand: 0, reserved: 0 };
    current.onHand += toFiniteNumber(row.onHand);
    current.reserved += toFiniteNumber(row.reserved);
    summaries.set(key, current);
  }
  return summaries;
}

export async function listOrderableSupplyCatalogItems({
  restaurantId,
  warehouseId = null,
  search = null,
  includeOutOfStock = true,
  session = null,
} = {}) {
  const rid = toId(restaurantId);
  if (!rid) return [];

  const filter = { restaurantId: rid, ...ACTIVE_SUPPLY_FILTER };
  const keyword = String(search || "").trim();
  if (keyword) {
    const regex = new RegExp(escapeRegex(keyword), "i");
    filter.$and = [
      {
        $or: [
          { name: regex },
          { sku: regex },
          { category: regex },
          { notes: regex },
        ],
      },
    ];
  }

  let query = Supply.find(filter)
    .select({ __v: 0 })
    .sort({ category: 1, name: 1, _id: 1 });
  if (session) query = query.session(session);
  const supplies = await query.lean({ virtuals: true });
  if (!supplies.length) return [];

  const stockBySupplyId = await loadStockSummary({
    restaurantId: rid,
    warehouseId,
    supplyIds: supplies.map((supply) => supply._id),
    session,
  });

  const items = supplies.map((supply) =>
    mapSupplyToCatalogItem(supply, stockBySupplyId.get(String(supply._id))),
  );
  return includeOutOfStock
    ? items
    : items.filter((item) => item.status === "available");
}

export async function getOrderableSupplyCatalogItem({
  restaurantId,
  supplyId,
  warehouseId = null,
  includeOutOfStock = true,
  session = null,
} = {}) {
  const rid = toId(restaurantId);
  const sid = toId(supplyId);
  if (!rid || !sid) return null;

  let query = Supply.findOne({
    _id: sid,
    restaurantId: rid,
    ...ACTIVE_SUPPLY_FILTER,
  }).select({ __v: 0 });
  if (session) query = query.session(session);
  const supply = await query.lean({ virtuals: true });
  if (!supply) return null;

  const stockBySupplyId = await loadStockSummary({
    restaurantId: rid,
    warehouseId,
    supplyIds: [sid],
    session,
  });
  const item = mapSupplyToCatalogItem(
    supply,
    stockBySupplyId.get(String(sid)),
  );
  if (!includeOutOfStock && item.status !== "available") return null;
  return item;
}
