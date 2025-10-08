import mongoose from "mongoose";
import { GraphQLError } from "graphql";

import {
  reserveForOrderTx,
  commitReservationForOrderTx,
  cancelReservationForOrderTx,
} from "../../../src/services/inventory.service.js";

function validateIds(...ids) {
  return ids.every((id) => mongoose.isValidObjectId(id));
}

export default {
  // Giữ chỗ (tăng reserved, không trừ onHand)
  reserveForOrder: async (_p, { input }) => {
    const { restaurantId, warehouseId } = input || {};
    if (!validateIds(restaurantId, warehouseId)) {
      throw new GraphQLError("Invalid restaurantId or warehouseId");
    }
    try {
      const res = await reserveForOrderTx(input);
      return res;
    } catch (e) {
      throw new GraphQLError(e.message || "reserveForOrder failed");
    }
  },

  // Xuất kho thật cho reservation (giảm reserved + onHand, FEFO batches, log movement)
  commitReservationForOrder: async (_p, { input }) => {
    const { restaurantId, warehouseId } = input || {};
    if (!validateIds(restaurantId, warehouseId)) {
      throw new GraphQLError("Invalid restaurantId or warehouseId");
    }
    try {
      const res = await commitReservationForOrderTx(input);
      return res;
    } catch (e) {
      throw new GraphQLError(e.message || "commitReservationForOrder failed");
    }
  },

  // Huỷ giữ chỗ (giảm reserved, không đụng onHand)
  cancelReservationForOrder: async (_p, { input }) => {
    const { restaurantId, warehouseId } = input || {};
    if (!validateIds(restaurantId, warehouseId)) {
      throw new GraphQLError("Invalid restaurantId or warehouseId");
    }
    try {
      const res = await cancelReservationForOrderTx(input);
      return res;
    } catch (e) {
      throw new GraphQLError(e.message || "cancelReservationForOrder failed");
    }
  },
};
