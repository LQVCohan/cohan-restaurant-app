// src/graphql/resolvers/inventory/consume.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { consumeForOrderTx } from "../../../src/services/inventory.service.js";
import { Warehouse } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

async function resolveWarehouseIdOrDefault(restaurantId, warehouseIdInput) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new GraphQLError("Invalid restaurantId");
  }

  // Nếu FE truyền warehouseId thì validate và dùng luôn
  if (warehouseIdInput) {
    if (!mongoose.isValidObjectId(warehouseIdInput)) {
      throw new GraphQLError("Invalid warehouseId");
    }
    return warehouseIdInput;
  }

  // Không truyền warehouseId → lấy kho đầu tiên (kho chính) của nhà hàng
  const wh = await Warehouse.findOne({
    restaurantId,
    isActive: true,
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (!wh) {
    throw new GraphQLError("No warehouse found for this restaurant");
  }

  return wh._id;
}

function normalizeLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new GraphQLError("lines is required");
  }

  return lines.map((l, idx) => {
    if (!l || !mongoose.isValidObjectId(l.menuItemId)) {
      throw new GraphQLError(`Invalid menuItemId at lines[${idx}]`);
    }

    // Normalize numbers (GraphQL Float đôi khi đã là number, nhưng normalize cho chắc)
    const quantity =
      l.quantity === null || l.quantity === undefined
        ? undefined
        : Number(l.quantity);
    const weightGrams =
      l.weightGrams === null || l.weightGrams === undefined
        ? undefined
        : Number(l.weightGrams);

    if (quantity !== undefined && !Number.isFinite(quantity)) {
      throw new GraphQLError(`Invalid quantity at lines[${idx}]`);
    }
    if (weightGrams !== undefined && !Number.isFinite(weightGrams)) {
      throw new GraphQLError(`Invalid weightGrams at lines[${idx}]`);
    }

    return {
      ...l,
      quantity,
      weightGrams,
      // servingKey/preparationMethodName/servingMode giữ nguyên, service tự xử lý
    };
  });
}

export default {
  consumeForOrder: async (_p, { input }, ctx) => {
    const { restaurantId, orderCode, lines } = input || {};

    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    if (!orderCode || !String(orderCode).trim()) {
      throw new GraphQLError("orderCode is required");
    }

    try {
      await requireRestaurantAccess(ctx, restaurantId);

      const warehouseId = await resolveWarehouseIdOrDefault(
        restaurantId,
        input.warehouseId
      );

      const normalizedLines = normalizeLines(lines);

      const res = await consumeForOrderTx({
        restaurantId,
        warehouseId,
        orderCode: String(orderCode).trim(),
        lines: normalizedLines,
        // allowNegative hiện service mới chưa xử lý logic âm (nếu cần mình sẽ bổ sung sau)
        allowNegative: !!input.allowNegative,
      });

      return res;
    } catch (e) {
      throw new GraphQLError(e?.message || "consumeForOrder failed");
    }
  },
};
