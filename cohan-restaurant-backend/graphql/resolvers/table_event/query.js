import mongoose from "mongoose";
import { TableEvent } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

export const TableEventQuery = {
  async tableEventsByTable(_, { restaurantId, tableId }, ctx) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    if (!mongoose.isValidObjectId(tableId)) {
      throw new Error("Invalid tableId");
    }
    await requireRestaurantAccess(ctx, restaurantId);

    return TableEvent.find({
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      tableId: new mongoose.Types.ObjectId(tableId),
    })
      .sort({ createdAt: -1, _id: -1 })
      .lean({ virtuals: true });
  },
};
