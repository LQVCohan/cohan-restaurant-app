import mongoose from "mongoose";
import { GraphQLError } from "graphql";

import { Warehouse, StockItem } from "../../../models/index.js";
export default {
  createWarehouse: async (_p, { input }) => {
    if (!mongoose.isValidObjectId(input.restaurantId))
      throw new GraphQLError("Invalid restaurantId");
    const created = await Warehouse.create(input);
    return created.toObject({ virtuals: true });
  },
  updateWarehouse: async (_p, { input }) => {
    const { id, ...patch } = input;
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");
    const doc = await Warehouse.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });
    if (!doc) throw new GraphQLError("Warehouse not found");
    return doc;
  },
  deleteWarehouse: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const count = await StockItem.countDocuments({ warehouseId: id });
    if (count > 0)
      throw new GraphQLError("Cannot delete warehouse with stock items");
    const res = await Warehouse.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },
};
