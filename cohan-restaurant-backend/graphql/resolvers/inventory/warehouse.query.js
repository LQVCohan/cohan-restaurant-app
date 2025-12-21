// src/graphql/resolvers/inventory/warehouse.query.js
import mongoose from "mongoose";
import { Warehouse } from "../../../models/index.js";

export default {
  warehouses: async (_p, { restaurantId }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    return Warehouse.find({ restaurantId, isActive: true })
      .select({ __v: 0 })
      .sort({ name: 1 })
      .lean({ virtuals: true });
  },
};
