// src/graphql/resolvers/inventory/warehouse.mutation.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Warehouse, StockItem } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

function normalizeDupKeyError(err) {
  if (err?.code === 11000) return new GraphQLError("Duplicate warehouse");
  return err;
}

export default {
  createWarehouse: async (_p, { input }, ctx) => {
    if (!mongoose.isValidObjectId(input?.restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }
    await requireRestaurantAccess(ctx, input.restaurantId);

    try {
      const created = await Warehouse.create(input);
      return created.toObject({ virtuals: true });
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "createWarehouse failed");
    }
  },

  updateWarehouse: async (_p, { input }, ctx) => {
    const { id, ...patch } = input || {};
    if (!mongoose.isValidObjectId(id)) throw new GraphQLError("Invalid id");

    const existing = await Warehouse.findById(id).lean();
    if (!existing) throw new GraphQLError("Warehouse not found");

    await requireRestaurantAccess(ctx, existing.restaurantId);
    delete patch.restaurantId;

    try {
      const doc = await Warehouse.findByIdAndUpdate(
        id,
        { $set: patch },
        { new: true, runValidators: true }
      ).lean({ virtuals: true });

      if (!doc) throw new GraphQLError("Warehouse not found");
      return doc;
    } catch (err) {
      const e = normalizeDupKeyError(err);
      if (e instanceof GraphQLError) throw e;
      throw new GraphQLError(e?.message || "updateWarehouse failed");
    }
  },

  deleteWarehouse: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;

    const existing = await Warehouse.findById(id).lean();
    if (!existing) return false;

    await requireRestaurantAccess(ctx, existing.restaurantId);

    const count = await StockItem.countDocuments({ warehouseId: id });
    if (count > 0)
      throw new GraphQLError("Cannot delete warehouse with stock items");

    const res = await Warehouse.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },
};
