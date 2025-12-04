import mongoose from "mongoose";
import Floor from "../../../models/floor.model.js";

export default {
  // Lấy danh sách tất cả tầng của nhà hàng
  floors: async (_parent, { restaurantId }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    // Trả về danh sách tầng (kèm theo layout nếu cần)
    return Floor.find({ restaurantId })
      .sort({ level: 1 })
      .lean({ virtuals: true });
  },

  // Lấy tầng theo level (Tầng 1, Tầng 2...)
  floorByLevel: async (_p, { restaurantId, level }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;

    return Floor.findOne({ restaurantId, level }).lean({ virtuals: true });
  },

  // ✅ BỔ SUNG: Lấy chi tiết tầng theo ID (Dùng cho trang Designer để load data)
  floor: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return null;
    return Floor.findById(id).lean({ virtuals: true });
  },
};
