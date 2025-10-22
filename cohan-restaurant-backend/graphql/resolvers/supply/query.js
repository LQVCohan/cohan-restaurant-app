import { Supply } from "../../../models/index.js";
import mongoose from "mongoose";

export default {
  // Danh sách supply
  supplies: async (_p, { restaurantId, category, isActive, search, limit }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const q = { restaurantId };

    if (category?.trim()) q.category = new RegExp(category.trim(), "i");
    if (typeof isActive === "boolean") q.isActive = isActive;

    if (search?.trim()) {
      const rx = new RegExp(search.trim(), "i");
      q.$or = [{ name: rx }, { sku: rx }, { category: rx }, { notes: rx }];
    }

    return Supply.find(q)
      .select({ __v: 0 })
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit ?? 200, 500))
      .lean({ virtuals: true });
  },

  // Lấy 1 supply theo ID
  supply: async (_p, { id, restaurantId }) => {
    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(restaurantId)
    )
      return null;

    return Supply.findOne({ _id: id, restaurantId }).lean({ virtuals: true });
  },
};
