import mongoose from "mongoose";
import { requireRestaurantAccess } from "../../guards.js";
import Floor from "../../../models/floor.model.js";

export default {
  // Lấy danh sách tất cả tầng của nhà hàng
  floors: async (_parent, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    await requireRestaurantAccess(ctx, restaurantId);

    // Trả về danh sách tầng (kèm theo layout nếu cần)
    return Floor.find({ restaurantId })
      .sort({ level: 1 })
      .lean({ virtuals: true });
  },

  // Lấy tầng theo level (Tầng 1, Tầng 2...)
  floorByLevel: async (_p, { restaurantId, level }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;

    await requireRestaurantAccess(ctx, restaurantId);

    return Floor.findOne({ restaurantId, level }).lean({ virtuals: true });
  },

  // ✅ BỔ SUNG: Lấy chi tiết tầng theo ID (Dùng cho trang Designer để load data)
  floor: async (_p, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return null;

    const existing = await Floor.findById(id)
      .select({ restaurantId: 1 })
      .lean();
    if (!existing) return null;

    await requireRestaurantAccess(ctx, existing.restaurantId);

    return Floor.findById(id).lean({ virtuals: true });
  },
};
