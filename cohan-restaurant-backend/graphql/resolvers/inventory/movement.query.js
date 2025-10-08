import mongoose from "mongoose";
import { StockMovement } from "../../../models/index.js";

function buildDateFilter(dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return null;
  const r = {};
  if (dateFrom) r.$gte = new Date(dateFrom);
  if (dateTo) r.$lte = new Date(dateTo);
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
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    const q = { restaurantId };

    if (warehouseId && mongoose.isValidObjectId(warehouseId))
      q.warehouseId = warehouseId;
    if (ingredientId && mongoose.isValidObjectId(ingredientId))
      q.ingredientId = ingredientId;
    if (type) q.type = type;

    // match orderCode ở reason hoặc meta.orderCode
    if (orderCode?.trim()) {
      const oc = orderCode.trim();
      q.$or = [
        { reason: new RegExp(`order:${oc}$`, "i") },
        { "meta.orderCode": oc },
      ];
    }

    const createdAt = buildDateFilter(dateFrom, dateTo);
    if (createdAt) q.createdAt = createdAt;

    const docs = await StockMovement.find(q)
      .sort({ createdAt: sort === 1 ? 1 : -1 })
      .limit(Math.min(limit ?? 200, 1000))
      .lean({ virtuals: true });

    return docs;
  },

  stockMovementSummary: async (
    _,
    { restaurantId, warehouseId, ingredientId, dateFrom, dateTo }
  ) => {
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
          inbound += r.totalQty || 0;
          break;
        case "outbound":
          outbound += Math.abs(r.totalQty || 0);
          break; // qty outbound lưu âm → lấy trị tuyệt đối
        case "adjustment":
          adjustment += r.totalQty || 0;
          break;
        case "transfer":
          // chuyển kho ghi hai bản ghi: âm ở kho nguồn, dương ở kho đích (đều type="transfer")
          // Nếu bạn muốn tách rõ in/out theo sign:
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
