import mongoose from "mongoose";
import { TableEvent } from "../../../models/index.js";
import Table from "../../../models/table.model.js";
import { requireRestaurantAccess } from "../../guards.js";

export const TableEventMutation = {
  async createTableEvent(_, { input }, ctx) {
    const { restaurantId, tableId } = input || {};
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    if (!mongoose.isValidObjectId(tableId)) {
      throw new Error("Invalid tableId");
    }
    await requireRestaurantAccess(ctx, restaurantId);
    const table = await Table.findOne({
      _id: new mongoose.Types.ObjectId(tableId),
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
    }).select({ _id: 1 }).lean();
    if (!table) throw new Error("Table not found");

    const created = await TableEvent.create(input);
    return created.toObject({ virtuals: true });
  },
};
