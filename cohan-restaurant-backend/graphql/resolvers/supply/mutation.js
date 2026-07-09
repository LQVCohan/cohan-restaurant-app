import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Supply, StockItem, StockMovement, SupplyCategory } from "../../../models/index.js";
import Warehouse from "../../../models/warehouse.model.js";
import { findOrCreateSupplyCategory, isValidObjectId, toEnglishCategoryName } from "./mutation.support.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

const SOFT_DELETE_RETENTION_DAYS = 30;
const ACTIVE_SUPPLY_FILTER = { $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] };

function buildStockInsertDefaults(supply) {
  return {
    reserved: 0,
    costPerUnit: supply?.costPerUnit ?? 0,
    pricePerUnit: supply?.pricePerUnit ?? 0,
    note: supply?.notes ?? "",
  };
}

function sortBatchesFIFO(batches) {
  return [...(batches || [])].sort((a, b) => {
    const ax = a.expiry ? new Date(a.expiry).getTime() : Number.MAX_SAFE_INTEGER;
    const bx = b.expiry ? new Date(b.expiry).getTime() : Number.MAX_SAFE_INTEGER;
    if (ax !== bx) return ax - bx;
    const ac = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bc = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ac - bc;
  });
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCode(value) {
  return String(value || "").trim().toLowerCase();
}

async function assertSupplyBusinessUnique({ restaurantId, excludeId = null, name, sku, category, session }) {
  const matchScope = { restaurantId, ...ACTIVE_SUPPLY_FILTER };
  if (excludeId && mongoose.isValidObjectId(excludeId)) {
    matchScope._id = { $ne: new mongoose.Types.ObjectId(String(excludeId)) };
  }

  const candidates = await Supply.find(matchScope)
    .select({ _id: 1, name: 1, sku: 1, category: 1 })
    .lean()
    .session(session || null);

  const normalizedSku = normalizeCode(sku);
  if (normalizedSku) {
    const existedSku = candidates.find((item) => normalizeCode(item?.sku) === normalizedSku);
    if (existedSku) {
      throw new GraphQLError("Mã vật tư đã tồn tại. Vui lòng dùng mã khác.", {
        extensions: { code: "DUPLICATE_SUPPLY_CODE" },
      });
    }
  }

  const normalizedName = normalizeText(name);
  const normalizedCategory = normalizeText(category);
  const existedName = candidates.find((item) => normalizeText(item?.name) === normalizedName && normalizeText(item?.category) === normalizedCategory);

  if (existedName) {
    const existedCategory = String(existedName.category || "Khác").trim() || "Khác";
    throw new GraphQLError(
      `Vật tư "${existedName.name}" đã tồn tại trong danh mục "${existedCategory}". Vui lòng dùng tên khác hoặc chỉnh sửa bản ghi hiện có.`,
      { extensions: { code: "DUPLICATE_SUPPLY_NAME" } },
    );
  }
}

async function getActiveSupplyOrThrow({ restaurantId, supplyId }) {
  const supply = await Supply.findOne({ _id: supplyId, restaurantId, ...ACTIVE_SUPPLY_FILTER }).lean();
  if (!supply) {
    throw new GraphQLError("Không tìm thấy vật tư đang hoạt động.", {
      extensions: { code: "SUPPLY_NOT_FOUND" },
    });
  }
  return supply;
}

async function assertWarehouseBelongsToRestaurant({ warehouseId, restaurantId }) {
  const wh = await Warehouse.findById(warehouseId).lean();
  if (!wh) throw new GraphQLError("Không tìm thấy kho đã chọn.", { extensions: { code: "NOT_FOUND" } });
  if (String(wh.restaurantId) !== String(restaurantId)) {
    throw new GraphQLError("Warehouse does not belong to this restaurant", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return wh;
}

export default {
  createSupply: async (_p, { input }, ctx) => {
    await requireRestaurantPermission(ctx, input.restaurantId, PERMISSIONS.INVENTORY_WRITE);
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const normalizedCategory = toEnglishCategoryName(input?.category) || "Other";
      const categoryDoc = await findOrCreateSupplyCategory({ restaurantId: input.restaurantId, categoryName: normalizedCategory, source: "ai", session });
      const normalizedSku = String(input?.sku || "").trim();

      await assertSupplyBusinessUnique({ restaurantId: input.restaurantId, name: input?.name, sku: normalizedSku, category: categoryDoc?.name || normalizedCategory, session });

      const [doc] = await Supply.create([
        { ...input, sku: normalizedSku, category: categoryDoc?.name || normalizedCategory, deletedAt: null, deleteExpiresAt: null },
      ], { session });

      if (categoryDoc?._id) await SupplyCategory.updateOne({ _id: categoryDoc._id }, { $inc: { usageCount: 1 } }, { session });
      await session.commitTransaction();
      return doc.toObject({ virtuals: true });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  updateSupply: async (_p, { id, input }, ctx) => {
    if (!isValidObjectId(id)) return null;
    const existing = await Supply.findOne({ _id: id, ...ACTIVE_SUPPLY_FILTER }).select({ restaurantId: 1 }).lean();
    if (!existing) return null;
    await requireRestaurantPermission(ctx, existing.restaurantId, PERMISSIONS.INVENTORY_WRITE);
    const patch = { ...input };
    delete patch.restaurantId;
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const current = await Supply.findOne({ _id: id, ...ACTIVE_SUPPLY_FILTER }).session(session);
      if (!current) {
        await session.abortTransaction();
        return null;
      }
      const nextCategory = patch?.category !== undefined ? toEnglishCategoryName(patch?.category) || "Other" : current.category;
      const categoryDoc = await findOrCreateSupplyCategory({ restaurantId: current.restaurantId, categoryName: nextCategory, source: "ai", session });
      const normalizedSku = patch?.sku !== undefined ? String(patch?.sku || "").trim() : current.sku || "";

      await assertSupplyBusinessUnique({ restaurantId: current.restaurantId, excludeId: id, name: patch?.name ?? current.name, sku: normalizedSku, category: categoryDoc?.name || nextCategory, session });

      current.set({ ...patch, sku: normalizedSku, category: categoryDoc?.name || nextCategory });
      await current.save({ session });
      if (categoryDoc?._id) await SupplyCategory.updateOne({ _id: categoryDoc._id }, { $inc: { usageCount: 1 } }, { session });
      await session.commitTransaction();
      return current.toObject({ virtuals: true });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  deleteSupply: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const existing = await Supply.findOne({ _id: id, ...ACTIVE_SUPPLY_FILTER });
    if (!existing) return false;
    await requireRestaurantPermission(ctx, existing.restaurantId, PERMISSIONS.INVENTORY_WRITE);
    const now = new Date();
    existing.set({
      isActive: false,
      deletedAt: now,
      deleteExpiresAt: new Date(now.getTime() + SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
    });
    await existing.save();
    return true;
  },

  restoreSupply: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return null;
    const existing = await Supply.findOne({ _id: id, deletedAt: { $ne: null } });
    if (!existing) return null;
    await requireRestaurantPermission(ctx, existing.restaurantId, PERMISSIONS.INVENTORY_WRITE);
    await assertSupplyBusinessUnique({ restaurantId: existing.restaurantId, excludeId: id, name: existing.name, sku: existing.sku, category: existing.category });
    existing.set({ deletedAt: null, deleteExpiresAt: null, isActive: true });
    await existing.save();
    return existing.toObject({ virtuals: true });
  },

  adjustSupply: async (_p, { input }, ctx) => {
    const { restaurantId, warehouseId, supplyId, qty, reason, meta } = input;
    const nQty = Number(qty);
    if (![restaurantId, warehouseId, supplyId].every(mongoose.isValidObjectId)) throw new Error("Invalid IDs");
    if (!Number.isFinite(nQty) || nQty === 0) throw new Error("qty must be a non-zero number");
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_WRITE);
    await assertWarehouseBelongsToRestaurant({ warehouseId, restaurantId });
    const supply = await getActiveSupplyOrThrow({ restaurantId, supplyId });
    const stock = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId, supplyId },
      { $setOnInsert: buildStockInsertDefaults(supply), $inc: { onHand: nQty } },
      { new: true, upsert: true },
    );
    await StockMovement.create({ restaurantId, warehouseId, itemType: "supply", itemId: supplyId, supplyId, type: "adjustment", qty: nQty, reason, meta });
    return stock.toObject({ virtuals: true });
  },

  stockInbound: async (_p, { input }, ctx) => {
    const { restaurantId, warehouseId, supplyId, qty, costPerBaseUnit, lot, expiry, supplier, reason, meta } = input;
    const nQty = Number(qty);
    if (![restaurantId, warehouseId, supplyId].every(mongoose.isValidObjectId)) throw new GraphQLError("Thông tin kho hoặc vật tư không hợp lệ.", { extensions: { code: "BAD_USER_INPUT" } });
    if (!Number.isFinite(nQty) || nQty <= 0) throw new GraphQLError("Số lượng nhập phải lớn hơn 0.", { extensions: { code: "BAD_USER_INPUT" } });
    const nCost = costPerBaseUnit === null || costPerBaseUnit === undefined ? 0 : Number(costPerBaseUnit);
    if (!Number.isFinite(nCost) || nCost < 0) throw new GraphQLError("Giá nhập không hợp lệ.", { extensions: { code: "BAD_USER_INPUT" } });
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_WRITE);
    await assertWarehouseBelongsToRestaurant({ warehouseId, restaurantId });
    const supply = await getActiveSupplyOrThrow({ restaurantId, supplyId });

    const batchDoc = { qty: nQty, costPerBaseUnit: nCost };
    if (typeof lot === "string" && lot.trim()) batchDoc.lot = lot.trim();
    if (expiry) batchDoc.expiry = expiry;

    const session = await mongoose.startSession();
    let stock = null;
    try {
      await session.withTransaction(async () => {
        stock = await StockItem.findOneAndUpdate(
          { restaurantId, warehouseId, supplyId },
          { $setOnInsert: buildStockInsertDefaults(supply), $inc: { onHand: nQty }, $push: { batches: batchDoc } },
          { new: true, upsert: true, runValidators: true, session },
        );
        await StockMovement.create([{ restaurantId, warehouseId, itemType: "supply", itemId: supplyId, supplyId, type: "inbound", qty: nQty, reason, meta: { ...meta, lot: batchDoc.lot || null, expiry: batchDoc.expiry || null, supplier, costPerBaseUnit: nCost } }], { session });
      });
    } finally {
      session.endSession();
    }
    return stock.toObject({ virtuals: true });
  },

  stockOutbound: async (_p, { input }, ctx) => {
    const { restaurantId, warehouseId, supplyId, qty, reason, meta } = input;
    const nQty = Number(qty);
    if (![restaurantId, warehouseId, supplyId].every(mongoose.isValidObjectId)) throw new GraphQLError("Thông tin kho hoặc vật tư không hợp lệ.", { extensions: { code: "BAD_USER_INPUT" } });
    if (!Number.isFinite(nQty) || nQty <= 0) throw new GraphQLError("Số lượng xuất phải lớn hơn 0.", { extensions: { code: "BAD_USER_INPUT" } });
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_WRITE);
    await getActiveSupplyOrThrow({ restaurantId, supplyId });
    const stock = await StockItem.findOne({ restaurantId, warehouseId, supplyId });
    if (!stock) throw new GraphQLError("Vật tư này chưa có tồn kho tại kho đang chọn.", { extensions: { code: "STOCK_ITEM_NOT_FOUND" } });
    if ((stock.onHand || 0) < nQty) throw new GraphQLError("Không đủ tồn kho để xuất.", { extensions: { code: "INSUFFICIENT_STOCK", currentOnHand: Number(stock.onHand || 0) } });

    let remain = nQty;
    const sorted = sortBatchesFIFO(stock.batches);
    for (const b of sorted) {
      if (remain <= 0) break;
      const take = Math.min(b.qty, remain);
      b.qty -= take;
      remain -= take;
    }
    stock.batches = sorted.filter((b) => b.qty > 0);
    stock.onHand = (stock.onHand || 0) - nQty;
    await stock.save();
    await StockMovement.create({ restaurantId, warehouseId, itemType: "supply", itemId: supplyId, supplyId, type: "outbound", qty: -Math.abs(nQty), reason, meta });
    return stock.toObject({ virtuals: true });
  },

  stockTransfer: async (_p, { input }, ctx) => {
    const { restaurantId, fromWarehouseId, toWarehouseId, supplyId, qty, reason, meta } = input;
    const nQty = Number(qty);
    if (![restaurantId, fromWarehouseId, toWarehouseId, supplyId].every(mongoose.isValidObjectId)) throw new Error("Invalid IDs");
    if (!Number.isFinite(nQty) || nQty <= 0) throw new Error("qty must be > 0");
    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_WRITE);
    await getActiveSupplyOrThrow({ restaurantId, supplyId });
    if (fromWarehouseId === toWarehouseId) throw new Error("Cannot transfer to the same warehouse");
    const warehouses = await Warehouse.find({ _id: { $in: [fromWarehouseId, toWarehouseId] }, restaurantId }).lean();
    if (warehouses.length !== 2) throw new GraphQLError("Warehouse does not belong to this restaurant", { extensions: { code: "BAD_USER_INPUT" } });

    const supply = await Supply.findById(supplyId).lean();
    const fromStock = await StockItem.findOne({ restaurantId, warehouseId: fromWarehouseId, supplyId });
    if (!fromStock) throw new Error("No stock found in source warehouse");
    if ((fromStock.onHand || 0) < nQty) throw new Error("Insufficient stock in source warehouse");

    let remain = nQty;
    const sorted = sortBatchesFIFO(fromStock.batches);
    const transferredBatches = [];
    for (const batch of sorted) {
      if (remain <= 0) break;
      const take = Math.min(batch.qty, remain);
      batch.qty -= take;
      remain -= take;
      if (take > 0) transferredBatches.push({ lot: batch.lot, qty: take, expiry: batch.expiry, costPerBaseUnit: batch.costPerBaseUnit });
    }
    fromStock.batches = sorted.filter((b) => b.qty > 0);
    fromStock.onHand -= nQty;
    await fromStock.save();
    await StockMovement.create({ restaurantId, warehouseId: fromWarehouseId, itemType: "supply", itemId: supplyId, supplyId, type: "transfer", qty: -Math.abs(nQty), reason: reason || "Xuất kho chuyển kho", meta: { ...meta, toWarehouseId } });

    const toStock = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId: toWarehouseId, supplyId },
      { $setOnInsert: buildStockInsertDefaults(supply), $inc: { onHand: nQty } },
      { new: true, upsert: true },
    );
    for (const b of transferredBatches) toStock.batches.push(b);
    await toStock.save();
    await StockMovement.create({ restaurantId, warehouseId: toWarehouseId, itemType: "supply", itemId: supplyId, supplyId, type: "transfer", qty: nQty, reason: reason || "Nhập kho (từ kho khác)", meta: { ...meta, fromWarehouseId } });
    return true;
  },
};