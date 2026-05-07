import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { requireRestaurantAccess } from "../../guards.js";
import Floor from "../../../models/floor.model.js";
import Table from "../../../models/table.model.js";

export default {
  createFloor: async (_p, { input }, ctx) => {
    const { restaurantId } = input;

    if (!mongoose.isValidObjectId(restaurantId)) {
      throw new GraphQLError("Invalid restaurantId");
    }

    await requireRestaurantAccess(ctx, restaurantId);

    // input lúc này sẽ bao gồm cả trường 'layout' (nếu FE gửi lên)
    const created = await Floor.create(input);
    return created.toObject({ virtuals: true });
  },

  updateFloor: async (_p, { input }, ctx) => {
    const { id, ...patch } = input; // patch sẽ chứa { layout: [...] } khi FE gọi update

    if (!mongoose.isValidObjectId(id)) {
      throw new GraphQLError("Invalid id");
    }

    const existing = await Floor.findById(id)
      .select({ restaurantId: 1 })
      .lean();
    if (!existing) throw new GraphQLError("Floor not found");

    await requireRestaurantAccess(ctx, existing.restaurantId);

    delete patch.restaurantId;

    const doc = await Floor.findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true }
    ).lean({ virtuals: true });

    if (!doc) throw new GraphQLError("Floor not found");

    return doc;
  },

  deleteFloor: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return false;

    const existing = await Floor.findById(id)
      .select({ restaurantId: 1 })
      .lean();
    if (!existing) return false;

    await requireRestaurantAccess(ctx, existing.restaurantId);

    // Ràng buộc: chỉ cho xoá khi không còn bàn (logic cũ giữ nguyên)
    const count = await Table.countDocuments({ floorId: id });
    if (count > 0) {
      throw new GraphQLError("Cannot delete floor with existing tables");
    }

    const res = await Floor.deleteOne({ _id: id });
    return res.deletedCount > 0;
  },
};
