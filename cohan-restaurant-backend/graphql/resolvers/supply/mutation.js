import mongoose from "mongoose";
import { Supply, StockItem, StockMovement } from "../../../models/index.js";
import Warehouse from "../../../models/warehouse.model.js";

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

export default {
  // ===== CRUD =====
  createSupply: async (_p, { input }) => {
    const doc = await Supply.create(input);
    return doc.toObject({ virtuals: true });
  },

  updateSupply: async (_p, { id, input }) => {
    if (!mongoose.isValidObjectId(id)) return null;
    const doc = await Supply.findByIdAndUpdate(
      id,
      { $set: input },
      { new: true }
    );
    return doc?.toObject({ virtuals: true }) || null;
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

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(warehouseId) ||
      !mongoose.isValidObjectId(supplyId)
    )
      throw new Error("Invalid IDs");

    const wh = await Warehouse.findById(warehouseId).lean();
    if (!wh) throw new Error("Warehouse not found");

    const stock = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId, supplyId },
      {
        $setOnInsert: { onHand: 0, reserved: 0, batches: [] },
        $inc: { onHand: qty },
      },
      { new: true, upsert: true }
    );

    await StockMovement.create({
      restaurantId,
      warehouseId,
      itemType: "supply",
      itemId: supplyId,
      type: "adjustment",
      qty, // có thể âm/dương
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

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(warehouseId) ||
      !mongoose.isValidObjectId(supplyId)
    )
      throw new Error("Invalid IDs");
    if (!qty || qty <= 0) throw new Error("qty must be > 0");

    const wh = await Warehouse.findById(warehouseId).lean();
    if (!wh) throw new Error("Warehouse not found");

    const stock = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId, supplyId },
      {
        $setOnInsert: { onHand: 0, reserved: 0, batches: [] },
        $inc: { onHand: qty },
        $push: {
          batches: {
            lot,
            qty,
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
      qty, // dương
      reason,
      meta: { ...meta, lot, expiry, supplier, costPerBaseUnit },
    });

    return stock.toObject({ virtuals: true });
  },

  // ===== Xuất kho FIFO (outbound) =====
  stockOutbound: async (_p, { input }) => {
    const { restaurantId, warehouseId, supplyId, qty, reason, meta } = input;

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(warehouseId) ||
      !mongoose.isValidObjectId(supplyId)
    )
      throw new Error("Invalid IDs");
    if (!qty || qty <= 0) throw new Error("qty must be > 0");

    const stock = await StockItem.findOne({
      restaurantId,
      warehouseId,
      supplyId,
    });

    if (!stock) throw new Error("Stock item not found");
    if ((stock.onHand || 0) < qty) throw new Error("Insufficient stock");

    // FIFO: trừ từ batches cũ trước (ưu tiên expiry)
    let remain = qty;
    const sorted = sortBatchesFIFO(stock.batches);

    for (const b of sorted) {
      if (remain <= 0) break;
      const take = Math.min(b.qty, remain);
      b.qty -= take;
      remain -= take;
    }

    stock.batches = sorted.filter((b) => b.qty > 0);
    stock.onHand = (stock.onHand || 0) - qty;

    await stock.save();

    await StockMovement.create({
      restaurantId,
      warehouseId,
      itemType: "supply",
      itemId: supplyId,
      type: "outbound",
      qty: -Math.abs(qty), // ghi âm cho outbound
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

    if (
      !mongoose.isValidObjectId(restaurantId) ||
      !mongoose.isValidObjectId(fromWarehouseId) ||
      !mongoose.isValidObjectId(toWarehouseId) ||
      !mongoose.isValidObjectId(supplyId)
    )
      throw new Error("Invalid IDs");
    if (!qty || qty <= 0) throw new Error("qty must be > 0");

    if (fromWarehouseId === toWarehouseId)
      throw new Error("Cannot transfer to the same warehouse");

    // ===== 1️⃣: Trừ FIFO ở kho xuất =====
    const fromStock = await StockItem.findOne({
      restaurantId,
      warehouseId: fromWarehouseId,
      supplyId,
    });
    if (!fromStock) throw new Error("No stock found in source warehouse");
    if ((fromStock.onHand || 0) < qty)
      throw new Error("Insufficient stock in source warehouse");

    let remain = qty;
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
    fromStock.onHand -= qty;
    await fromStock.save();

    await StockMovement.create({
      restaurantId,
      warehouseId: fromWarehouseId,
      itemType: "supply",
      itemId: supplyId,
      type: "transfer",
      qty: -Math.abs(qty),
      reason: reason || "Xuất kho chuyển kho",
      meta: { ...meta, toWarehouseId },
    });

    // ===== 2️⃣: Cộng vào kho nhận =====
    const toStock = await StockItem.findOneAndUpdate(
      { restaurantId, warehouseId: toWarehouseId, supplyId },
      {
        $setOnInsert: { onHand: 0, reserved: 0, batches: [] },
        $inc: { onHand: qty },
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
      qty: qty,
      reason: reason || "Nhập kho (từ kho khác)",
      meta: { ...meta, fromWarehouseId },
    });

    return true;
  },
};
