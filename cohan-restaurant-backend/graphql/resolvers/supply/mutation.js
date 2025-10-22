import { Supply } from "../../../models/index.js";
import mongoose from "mongoose";

export default {
  // Thêm supply mới
  createSupply: async (_p, { input }) => {
    const { restaurantId, name, unit } = input;

    if (!mongoose.isValidObjectId(restaurantId))
      throw new Error("restaurantId không hợp lệ");
    if (!name?.trim()) throw new Error("Tên vật phẩm là bắt buộc");
    if (!unit) throw new Error("Đơn vị là bắt buộc");

    const doc = new Supply({
      restaurantId,
      name: name.trim(),
      sku: input.sku?.trim(),
      category: input.category?.trim(),
      unit,
      costPerUnit: input.costPerUnit ?? 0,
      pricePerUnit: input.pricePerUnit ?? 0,
      photos: input.photos ?? [],
      minStock: input.minStock ?? 0,
      notes: input.notes?.trim(),
      isActive: typeof input.isActive === "boolean" ? input.isActive : true,
    });

    await doc.save();
    return doc.toObject({ virtuals: true });
  },

  // Cập nhật supply
  updateSupply: async (_p, { id, input }) => {
    if (!mongoose.isValidObjectId(id)) throw new Error("ID không hợp lệ");

    const supply = await Supply.findById(id);
    if (!supply) throw new Error("Không tìm thấy vật phẩm");

    Object.entries(input).forEach(([key, val]) => {
      if (val !== undefined) supply[key] = val;
    });

    await supply.save();
    return supply.toObject({ virtuals: true });
  },

  // Xóa supply
  deleteSupply: async (_p, { id }) => {
    if (!mongoose.isValidObjectId(id)) return false;
    const result = await Supply.findByIdAndDelete(id);
    return !!result;
  },
};
