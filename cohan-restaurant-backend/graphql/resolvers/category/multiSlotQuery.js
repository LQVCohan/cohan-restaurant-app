import mongoose from "mongoose";
import { Category, Menu, MenuItem } from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

const TOP_DISH_SAMPLE = 1000;

const resolveMenuIds = async ({ restaurantId, timeSlot, menuId }) => {
  const filter = { restaurantId };
  if (menuId) {
    if (!mongoose.isValidObjectId(menuId)) return [];
    filter._id = menuId;
    filter.timeSlot = timeSlot;
  } else {
    filter.timeSlot = timeSlot;
  }

  const menus = await Menu.find(filter).select({ _id: 1 }).lean();
  return menus.map((menu) => menu._id);
};

export const CategoryMultiSlotQuery = {
  categories: async (_, { restaurantId, timeSlot, menuId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);

    const restaurantObjectId = new mongoose.Types.ObjectId(String(restaurantId));
    const categories = await Category.find({ restaurantId: restaurantObjectId })
      .sort({ order: 1, name: 1 })
      .lean({ virtuals: true });
    if (!categories.length) return [];

    const menuIds = await resolveMenuIds({ restaurantId, timeSlot, menuId });
    if (!menuIds.length) {
      return categories.map((category) => ({
        ...category,
        timeSlot: timeSlot || null,
        menuItemCount: 0,
      }));
    }

    const counts = await MenuItem.aggregate([
      {
        $match: {
          restaurantId: restaurantObjectId,
          menuId: { $in: menuIds },
        },
      },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(
      counts.map((row) => [String(row._id), Number(row.count || 0)]),
    );

    return categories.map((category) => ({
      ...category,
      timeSlot: timeSlot || null,
      menuItemCount: countMap.get(String(category._id)) || 0,
    }));
  },

  topCategoriesByMenuItemCount: async (
    _,
    { restaurantId, timeSlot, menuId, limit = 6 },
    ctx,
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);

    const menuIds = await resolveMenuIds({ restaurantId, timeSlot, menuId });
    if (!menuIds.length) return [];

    const restaurantObjectId = new mongoose.Types.ObjectId(String(restaurantId));
    const topMenuItems = await MenuItem.find({
      restaurantId: restaurantObjectId,
      menuId: { $in: menuIds },
    })
      .select({ categoryId: 1 })
      .sort({ rate: -1, orderCounter: -1, createdAt: -1, _id: 1 })
      .limit(TOP_DISH_SAMPLE)
      .lean();
    if (!topMenuItems.length) return [];

    const counter = new Map();
    for (const item of topMenuItems) {
      const key = String(item.categoryId);
      counter.set(key, (counter.get(key) || 0) + 1);
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 100);
    const topCategoryIds = [...counter.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, safeLimit)
      .map(([id]) => id);

    const categories = await Category.find({
      _id: { $in: topCategoryIds },
      restaurantId: restaurantObjectId,
    }).lean({ virtuals: true });
    const categoryMap = new Map(
      categories.map((category) => [String(category._id), category]),
    );

    return topCategoryIds
      .map((id) => {
        const category = categoryMap.get(id);
        if (!category) return null;
        return {
          ...category,
          timeSlot: timeSlot || null,
          menuItemCount: counter.get(id) || 0,
        };
      })
      .filter(Boolean);
  },
};
