import mongoose from "mongoose";
import { Category, Menu, MenuItem } from "../../../models/index.js";

export const CustomerCategoryQuery = {
  customerMenuCategories: async (_, { restaurantId, timeSlot }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    const restaurantObjectId = new mongoose.Types.ObjectId(String(restaurantId));

    const menu = await Menu.findOne({
      restaurantId,
      timeSlot,
      isActive: true,
    }).lean();
    if (!menu) return [];

    const categories = await Category.find({
      restaurantId: restaurantObjectId,
      isActive: { $ne: false },
    })
      .sort({ order: 1, name: 1 })
      .lean({ virtuals: true });
    if (!categories.length) return [];

    const counts = await MenuItem.aggregate([
      {
        $match: {
          restaurantId: restaurantObjectId,
          menuId: menu._id,
          status: { $in: ["available", "out_of_stock"] },
        },
      },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      counts.map((row) => [String(row._id), Number(row.count || 0)]),
    );

    return categories
      .filter((category) => (countMap.get(String(category._id)) || 0) > 0)
      .map((category) => ({
        ...category,
        timeSlot: timeSlot || null,
        menuItemCount: countMap.get(String(category._id)) || 0,
      }));
  },
};
