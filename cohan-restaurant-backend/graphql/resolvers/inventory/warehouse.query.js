// src/graphql/resolvers/inventory/warehouse.query.js
import mongoose from "mongoose";
import { Warehouse } from "../../../models/index.js";
import { PERMISSIONS } from "../../../src/constants/permissions.js";
import { requireRestaurantPermission } from "../../../src/services/auth/authorization.service.js";

export default {
  warehouses: async (_p, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    await requireRestaurantPermission(ctx, restaurantId, PERMISSIONS.INVENTORY_READ);

    return Warehouse.find({ restaurantId, isActive: true })
      .select({ __v: 0 })
      .sort({ createdAt: 1, name: 1, _id: 1 })
      .lean({ virtuals: true });
  },
};
