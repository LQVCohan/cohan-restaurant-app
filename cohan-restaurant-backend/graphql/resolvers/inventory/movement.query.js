import mongoose from "mongoose";
import { StockMovement } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toValidDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

function buildDateFilter(dateFrom, dateTo) {
  const from = toValidDateOrNull(dateFrom);
  const to = toValidDateOrNull(dateTo);

  if (!from && !to) return null;

  const r = {};
  if (from) r.$gte = from;
  if (to) r.$lte = to;
  return r;
}

export default {
  stockMovements: async (
    _,
    {
      restaurantId,
      warehouseId,
      ingredientId,
      type,
      orderCode,
      dateFrom,
      dateTo,
      limit,
      sort,
    }
  , ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_READ);

    const q = { restaurantId };

    if (warehouseId && mongoose.isValidObjectId(warehouseId))
      q.warehouseId = warehouseId;
    if (ingredientId && mongoose.isValidObjectId(ingredientId))
      q.ingredientId = ingredientId;

    // type là enum GraphQL, ok
    if (type) q.type = type;

    // match orderCode ở reason hoặc meta.orderCode
    if (orderCode?.trim()) {
      const oc = orderCode.trim();
      const ocEsc = escapeRegex(oc);

      q.$or = [
        // service bạn đang ghi reason: `order:${orderCode}`
        { reason: new RegExp(`order:${ocEsc}$`, "i") },
        { "meta.orderCode": oc },
      ];
    }

    const createdAt = buildDateFilter(dateFrom, dateTo);
    if (createdAt) q.createdAt = createdAt;

    const safeLimit = Math.min(limit ?? 200, 1000);
    const sortDir = sort === 1 ? 1 : -1;

    return StockMovement.find(q)
      .select({ __v: 0 })
      .sort({ createdAt: sortDir })
      .limit(safeLimit)
      .lean({ virtuals: true });
  },

  stockMovementSummary: async (
    _,
    { restaurantId, warehouseId, ingredientId, dateFrom, dateTo }
  , ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) {
      return {
        inbound: 0,
        outbound: 0,
        adjustment: 0,
        transferIn: 0,
        transferOut: 0,
        net: 0,
        count: 0,
      };
    }

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.STOCK_READ);

    const match = { restaurantId };
    if (warehouseId && mongoose.isValidObjectId(warehouseId))
      match.warehouseId = warehouseId;
    if (ingredientId && mongoose.isValidObjectId(ingredientId))
      match.ingredientId = ingredientId;

    const createdAt = buildDateFilter(dateFrom, dateTo);
    if (createdAt) match.createdAt = createdAt;

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: "$type",
          totalQty: { $sum: "$qty" },
          count: { $sum: 1 },
        },
      },
    ];

    const rows = await StockMovement.aggregate(pipeline);

    let inbound = 0,
      outbound = 0,
      adjustment = 0,
      transferIn = 0,
      transferOut = 0,
      count = 0;

    for (const r of rows) {
      count += r.count || 0;

      switch (r._id) {
        case "inbound":
          // inbound thường dương
          inbound += r.totalQty || 0;
          break;

        case "outbound":
          // outbound service đang lưu âm → lấy trị tuyệt đối
          outbound += Math.abs(r.totalQty || 0);
          break;

        case "adjustment":
          // adjustment có thể +/-
          adjustment += r.totalQty || 0;
          break;

        case "transfer":
          // transfer ghi 2 dòng cùng type="transfer":
          // - kho nguồn: qty âm
          // - kho đích: qty dương
          if ((r.totalQty || 0) >= 0) transferIn += r.totalQty || 0;
          else transferOut += Math.abs(r.totalQty || 0);
          break;
      }
    }

    const net = inbound + transferIn - outbound - transferOut + adjustment;

    return {
      inbound,
      outbound,
      adjustment,
      transferIn,
      transferOut,
      net,
      count,
    };
  },
};
