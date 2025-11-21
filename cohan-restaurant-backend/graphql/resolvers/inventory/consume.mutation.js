// src/graphql/resolvers/inventory/consume.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { consumeForOrderTx } from "../../../src/services/inventory.service.js";
import { Warehouse } from "../../../models/index.js";

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

export default {
  consumeForOrder: async (_p, { input }) => {
    const { restaurantId } = input || {};
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    try {
      const warehouseId = await resolveWarehouseIdOrDefault(
        restaurantId,
        input.warehouseId
      );

      const res = await consumeForOrderTx({
        ...input,
        warehouseId,
      });
      return res;
    } catch (e) {
      throw new GraphQLError(e.message || "consumeForOrder failed");
    }
  },
};
