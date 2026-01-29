import mongoose from "mongoose";
import { TableEvent } from "../../../models/index.js";

export const TableEventQuery = {
  async tableEventsByTable(_, { restaurantId, tableId }) {
    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new Error("Invalid restaurantId");
    }
    if (!mongoose.isValidObjectId(tableId)) {
      throw new Error("Invalid tableId");
    }

    return TableEvent.find({
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      tableId: new mongoose.Types.ObjectId(tableId),
    })
      .sort({ createdAt: -1, _id: -1 })
      .lean({ virtuals: true });
  },
};
