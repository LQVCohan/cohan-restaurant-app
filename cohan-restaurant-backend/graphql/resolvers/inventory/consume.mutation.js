import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { consumeForOrderTx } from "../../../src/services/inventory.service.js";

export default {
  consumeForOrder: async (_p, { input }) => {
    const { restaurantId, warehouseId } = input;
    if (![restaurantId, warehouseId].every(mongoose.isValidObjectId)) {
      throw new GraphQLError("Invalid restaurantId or warehouseId");
    }
    try {
      const res = await consumeForOrderTx(input);
      return res;
    } catch (e) {
      throw new GraphQLError(e.message || "consumeForOrder failed");
    }
  },
};
