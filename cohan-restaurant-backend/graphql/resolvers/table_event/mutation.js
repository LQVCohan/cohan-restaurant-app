import mongoose from "mongoose";
import { TableEvent } from "../../../models/index.js";

export const TableEventMutation = {
  async createTableEvent(_, { input }) {
    const { restaurantId, tableId } = input || {};
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    if (!mongoose.isValidObjectId(tableId)) {
      throw new Error("Invalid tableId");
    }

    const created = await TableEvent.create(input);
    return created.toObject({ virtuals: true });
  },
};
