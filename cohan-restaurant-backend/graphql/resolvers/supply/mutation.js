import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Supply, StockItem, StockMovement, SupplyCategory } from "../../../models/index.js";
import Warehouse from "../../../models/warehouse.model.js";
import { findOrCreateSupplyCategory, isValidObjectId, toEnglishCategoryName } from "./mutation.support.js";

function buildStockInsertDefaults(supply) {
  return {
    reserved: 0,
    batches: [],
    costPerUnit: supply?.costPerUnit ?? 0,
    pricePerUnit: supply?.pricePerUnit ?? 0,
    note: supply?.notes ?? "",
  };
}

function sortBatchesFIFO(batches) {
  return [...batches].sort((a, b) => {
    const ax = a.expiry
      ? new Date(a.expiry).getTime()
      : Number.MAX_SAFE_INTEGER;
    const bx = b.expiry
      ? new Date(b.expiry).getTime()
      : Number.MAX_SAFE_INTEGER;
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

async function assertSupplyBusinessUnique({
  restaurantId,
  excludeId = null,
  name,
  sku,
  category,
  session,
}) {
  const matchScope = { restaurantId };
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
  const existedName = candidates.find((item) => {
    if (normalizeText(item?.name) !== normalizedName) return false;
    return normalizeText(item?.category) === normalizedCategory;
  });

  if (existedName) {
    const existedCategory = String(existedName.category || "Khác").trim() || "Khác";
    throw new GraphQLError(
      `Vật tư "${existedName.name}" đã tồn tại trong danh mục "${existedCategory}". Vui lòng dùng tên khác hoặc chỉnh sửa bản ghi hiện có.`,
      { extensions: { code: "DUPLICATE_SUPPLY_NAME" } },
    );
  }
}

export default {
  // ===== CRUD =====
  createSupply: async (_p, { input }) => {
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const normalizedCategory = toEnglishCategoryName(input?.category) || "Other";
      const categoryDoc = await findOrCreateSupplyCategory({
        restaurantId: input.restaurantId,
        categoryName: normalizedCategory,
        source: "ai",
        session,
      });
      const normalizedSku = String(input?.sku || "").trim();

      await assertSupplyBusinessUnique({
        restaurantId: input.restaurantId,
        name: input?.name,
        sku: normalizedSku,
        category: categoryDoc?.name || normalizedCategory,
        session,
      });

      const [doc] = await Supply.create(
        [
          {
            ...input,
            sku: normalizedSku,
            category: categoryDoc?.name || normalizedCategory,
          },
        ],
        { session },
      );

      if (categoryDoc?._id) {
        await SupplyCategory.updateOne(
          { _id: categoryDoc._id },
          { $inc: { usageCount: 1 } },
          { session },
        );
      }

      await session.commitTransaction();
      return doc.toObject({ virtuals: true });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  updateSupply: async (_p, { id, input }) => {
    if (!isValidObjectId(id)) return null;
    const session = await mongoose.startSession();
    try {
      session.startTransaction();
      const current = await Supply.findById(id).session(session);
      if (!current) {
        await session.abortTransaction();
        return null;
      }

      const nextCategory =
        input?.category !== undefined
          ? toEnglishCategoryName(input?.category) || "Other"
          : current.category;

      const categoryDoc = await findOrCreateSupplyCategory({
        restaurantId: current.restaurantId,
        categoryName: nextCategory,
        source: "ai",
        session,
      });

      const normalizedSku =
        input?.sku !== undefined ? String(input?.sku || "").trim() : current.sku || "";

      await assertSupplyBusinessUnique({
        restaurantId: current.restaurantId,
        excludeId: id,
        name: input?.name ?? current.name,
        sku: normalizedSku,
        category: categoryDoc?.name || nextCategory,
        session,
      });

      current.set({
        ...input,
        sku: normalizedSku,
        category: categoryDoc?.name || nextCategory,
      });
      await current.save({ session });

      if (categoryDoc?._id) {
        await SupplyCategory.updateOne(
          { _id: categoryDoc._id },
          { $inc: { usageCount: 1 } },
          { session },
        );
      }

      await session.commitTransaction();
      return current.toObject({ virtuals: true });
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  },

  deleteSupply: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    await Supply.findByIdAndDelete(id);
    await StockItem.deleteMany({ supplyId: id }); // dọn stock liên quan
    return true;
  },

  // ===== Điều chỉnh ±qty =====
  adjustSupply: async (_p, { input }) => {
    const { restaurantId, warehouseId, supplyId, qty, reason, meta } = input;
    const nQty = Number(qty);

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(warehouseId) ||
      !mongoose.isValidObjectId(supplyId)
    )
      throw new Error("Invalid IDs");
    if (!Number.isFinite(nQty) || nQty === 0)
      throw new Error("qty must be a non-zero number");

    const wh = await Warehouse.findById(warehouseId).lean();
    if (!wh) throw new Error("Warehouse not found");

    const supply = await Supply.findById(supplyId).lean();
    const stock = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId, supplyId },
      {
        $setOnInsert: buildStockInsertDefaults(supply),
        $inc: { onHand: nQty },
      },
      { new: true, upsert: true }
    );

    await StockMovement.create({
      restaurantId,
      warehouseId,
      itemType: "supply",
      itemId: supplyId,
      type: "adjustment",
      qty: nQty, // có thể âm/dương
      reason,
      meta,
    });

    return stock.toObject({ virtuals: true });
  },

  // ===== Nhập kho (inbound) + thêm batch =====
  stockInbound: async (_p, { input }) => {
    const {
      restaurantId,
      warehouseId,
      supplyId,
      qty,
      costPerBaseUnit,
      lot,
      expiry,
      supplier,
      reason,
      meta,
    } = input;
    const nQty = Number(qty);

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(warehouseId) ||
      !mongoose.isValidObjectId(supplyId)
    )
      throw new Error("Invalid IDs");
    if (!Number.isFinite(nQty) || nQty <= 0) throw new Error("qty must be > 0");

    const wh = await Warehouse.findById(warehouseId).lean();
    if (!wh) throw new Error("Warehouse not found");

    const supply = await Supply.findById(supplyId).lean();
    const stock = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId, supplyId },
      {
        $setOnInsert: buildStockInsertDefaults(supply),
        $inc: { onHand: nQty },
        $push: {
          batches: {
            lot,
            qty: nQty,
            expiry,
            costPerBaseUnit: costPerBaseUnit ?? 0,
          },
        },
      },
      { new: true, upsert: true }
    );

    await StockMovement.create({
      restaurantId,
      warehouseId,
      itemType: "supply",
      itemId: supplyId,
      type: "inbound",
      qty: nQty, // dương
      reason,
      meta: { ...meta, lot, expiry, supplier, costPerBaseUnit },
    });

    return stock.toObject({ virtuals: true });
  },

  // ===== Xuất kho FIFO (outbound) =====
  stockOutbound: async (_p, { input }) => {
    const { restaurantId, warehouseId, supplyId, qty, reason, meta } = input;
    const nQty = Number(qty);

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(warehouseId) ||
      !mongoose.isValidObjectId(supplyId)
    )
      throw new Error("Invalid IDs");
    if (!Number.isFinite(nQty) || nQty <= 0) throw new Error("qty must be > 0");

    const stock = await StockItem.findOne({
      restaurantId,
      warehouseId,
      supplyId,
    });

    if (!stock) throw new Error("Stock item not found");
    if ((stock.onHand || 0) < nQty) throw new Error("Insufficient stock");

    // FIFO: trừ từ batches cũ trước (ưu tiên expiry)
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

    await StockMovement.create({
      restaurantId,
      warehouseId,
      itemType: "supply",
      itemId: supplyId,
      type: "outbound",
      qty: -Math.abs(nQty), // ghi âm cho outbound
      reason,
      meta,
    });

    return stock.toObject({ virtuals: true });
  },
  stockTransfer: async (_p, { input }) => {
    const {
      restaurantId,
      fromWarehouseId,
      toWarehouseId,
      supplyId,
      qty,
      reason,
      meta,
    } = input;
    const nQty = Number(qty);

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(fromWarehouseId) ||
      !mongoose.isValidObjectId(toWarehouseId) ||
      !mongoose.isValidObjectId(supplyId)
    )
      throw new Error("Invalid IDs");
    if (!Number.isFinite(nQty) || nQty <= 0) throw new Error("qty must be > 0");

    if (fromWarehouseId === toWarehouseId)
      throw new Error("Cannot transfer to the same warehouse");

    // ===== 1️⃣: Trừ FIFO ở kho xuất =====
    const supply = await Supply.findById(supplyId).lean();
    const fromStock = await StockItem.findOne({
      restaurantId,
      warehouseId: fromWarehouseId,
      supplyId,
    });
    if (!fromStock) throw new Error("No stock found in source warehouse");
    if ((fromStock.onHand || 0) < nQty)
      throw new Error("Insufficient stock in source warehouse");

    let remain = nQty;
    const sorted = sortBatchesFIFO(fromStock.batches);
    const transferredBatches = [];

    for (const batch of sorted) {
      if (remain <= 0) break;
      const take = Math.min(batch.qty, remain);
      batch.qty -= take;
      remain -= take;
      if (take > 0) {
        transferredBatches.push({
          lot: batch.lot,
          qty: take,
          expiry: batch.expiry,
          costPerBaseUnit: batch.costPerBaseUnit,
        });
      }
    }

    fromStock.batches = sorted.filter((b) => b.qty > 0);
    fromStock.onHand -= nQty;
    await fromStock.save();

    await StockMovement.create({
      restaurantId,
      warehouseId: fromWarehouseId,
      itemType: "supply",
      itemId: supplyId,
      type: "transfer",
      qty: -Math.abs(nQty),
      reason: reason || "Xuất kho chuyển kho",
      meta: { ...meta, toWarehouseId },
    });

    // ===== 2️⃣: Cộng vào kho nhận =====
    const toStock = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId: toWarehouseId, supplyId },
      {
        $setOnInsert: buildStockInsertDefaults(supply),
        $inc: { onHand: nQty },
      },
      { new: true, upsert: true }
    );

    for (const b of transferredBatches) {
      toStock.batches.push(b);
    }
    await toStock.save();

    await StockMovement.create({
      restaurantId,
      warehouseId: toWarehouseId,
      itemType: "supply",
      itemId: supplyId,
      type: "transfer",
      qty: nQty,
      reason: reason || "Nhập kho (từ kho khác)",
      meta: { ...meta, fromWarehouseId },
    });

    return true;
  },
};
