// src/graphql/resolvers/inventory/reservation.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";

import {
  reserveForOrderTx,
  commitReservationForOrderTx,
  cancelReservationForOrderTx,
} from "../../../src/services/inventory.service.js";
import { Warehouse } from "../../../models/index.js";

async function resolveWarehouseIdOrDefault(restaurantId, warehouseIdInput) {
  if (!mongoose.isValidObjectId(restaurantId)) {
    throw new GraphQLError("Invalid restaurantId");
  }

  if (warehouseIdInput) {
    if (!mongoose.isValidObjectId(warehouseIdInput)) {
      throw new GraphQLError("Invalid warehouseId");
    }
    return warehouseIdInput;
  }

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
  // Giữ chỗ (reserved tăng, onHand không đổi)
  reserveForOrder: async (_p, { input }) => {
    const { restaurantId } = input || {};
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    try {
      const warehouseId = await resolveWarehouseIdOrDefault(
        restaurantId,
        input.warehouseId
      );

      const res = await reserveForOrderTx({
        ...input,
        warehouseId,
      });
      return res;
    } catch (e) {
      throw new GraphQLError(e.message || "reserveForOrder failed");
    }
  },

  // Commit: reserved giảm, onHand giảm, FEFO, tạo movement
  commitReservationForOrder: async (_p, { input }) => {
    const { restaurantId } = input || {};
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    try {
      const warehouseId = await resolveWarehouseIdOrDefault(
        restaurantId,
        input.warehouseId
      );

      const res = await commitReservationForOrderTx({
        ...input,
        warehouseId,
      });
      return res;
    } catch (e) {
      throw new GraphQLError(e.message || "commitReservationForOrder failed");
    }
  },

  // Huỷ giữ chỗ: reserved giảm, onHand không đổi
  cancelReservationForOrder: async (_p, { input }) => {
    const { restaurantId } = input || {};
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    try {
      const warehouseId = await resolveWarehouseIdOrDefault(
        restaurantId,
        input.warehouseId
      );

      const res = await cancelReservationForOrderTx({
        ...input,
        warehouseId,
      });
      return res;
    } catch (e) {
      throw new GraphQLError(e.message || "cancelReservationForOrder failed");
    }
  },
};
