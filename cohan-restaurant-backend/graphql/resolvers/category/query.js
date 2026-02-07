import mongoose from "mongoose";
import {
  Category,
  CategoryMenu,
  Menu,
  MenuItem,
} from "../../../models/index.js";

export const CategoryQuery = {
  categories: async (_, { restaurantId, timeSlot }) => {
    const categories = await Category.find({})
      .sort({ order: 1, name: 1 })
      .lean({ virtuals: true });

    if (!categories.length)
      return categories.map((c) => ({ ...c, menuItemCount: 0 }));

    const menu = await Menu.findOne({ restaurantId, timeSlot }).lean();
    if (!menu) return categories.map((c) => ({ ...c, menuItemCount: 0 }));

    const restaurantObjectId =
      typeof restaurantId === "string"
        ? new mongoose.Types.ObjectId(restaurantId)
        : restaurantId;

    const counts = await MenuItem.aggregate([
      {
        $match: {
          restaurantId: restaurantObjectId,
          menuId: menu._id,
        },
      },
      {
        $group: { _id: "$categoryId", count: { $sum: 1 } },
      },
    ]);

    const countMap = counts.reduce((acc, cur) => {
      acc[String(cur._id)] = cur.count;
      return acc;
    }, {});

    return categories.map((cat) => ({
      ...cat,
      timeSlot: timeSlot || null,
      menuItemCount: countMap[String(cat._id)] || 0,
    }));
  },

  topCategoriesByMenuItemCount: async (
    _,
    { restaurantId, timeSlot, limit = 6 }
  ) => {
    const menu = await Menu.findOne({ restaurantId, timeSlot }).lean();
    if (!menu) return [];

    const restaurantObjectId =
      typeof restaurantId === "string"
        ? new mongoose.Types.ObjectId(restaurantId)
        : restaurantId;

    const counts = await MenuItem.aggregate([
      {
        $match: {
          restaurantId: restaurantObjectId,
          menuId: menu._id,
        },
      },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    if (!counts.length) return [];

    const categoryIds = counts.map((c) => c._id);

    const categories = await Category.find({
      _id: { $in: categoryIds },
    }).lean({ virtuals: true });

    const categoryMap = new Map(categories.map((c) => [String(c._id), c]));

    return counts
      .map((c) => {
        const base = categoryMap.get(String(c._id));
        if (!base) return null;
        return { ...base, timeSlot: timeSlot || null, menuItemCount: c.count };
      })
      .filter(Boolean);
  },

  topGlobalCategoriesByMenuItemCount: async (_, { timeSlot, limit = 6 }) => {
    const menuFilter = {};
    if (timeSlot) menuFilter.timeSlot = timeSlot;

    const menus = await Menu.find(menuFilter, { _id: 1 }).lean();
    if (!menus.length) return [];

    const menuIds = menus.map((m) => m._id);

    const topDishes = await MenuItem.find({ menuId: { $in: menuIds } })
      .select({ _id: 1 })
      .sort({ point: -1, createdAt: -1, _id: 1 })
      .limit(1000)
      .lean();

    if (!topDishes.length) return [];

    const topDishIds = topDishes.map((dish) => dish._id);

    const rows = await MenuItem.aggregate([
      {
        $match: {
          _id: { $in: topDishIds },
          menuId: { $in: menuIds },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "categoryId",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $group: {
          _id: "$category.name",
          menuItemCount: { $sum: 1 },
          sampleCategoryId: { $first: "$category._id" },
          sampleRestaurantId: { $first: "$category.restaurantId" },
        },
      },
      { $sort: { menuItemCount: -1 } },
      { $limit: limit },
    ]);

    return rows.map((r) => ({
      id: String(r.sampleCategoryId),
      restaurantId: r.sampleRestaurantId ? String(r.sampleRestaurantId) : null,
      timeSlot: timeSlot || null,
      name: r._id,
      menuItemCount: r.menuItemCount,
      isActive: true,
    }));
  },

  categoryMenus: async (_, { restaurantId }) => {
    if (!restaurantId) return [];
    return CategoryMenu.find({ restaurantId })
      .sort({ name: 1 })
      .lean({ virtuals: true });
  },

  categoryMenu: async (_, { id }) => {
    return CategoryMenu.findById(id).lean({ virtuals: true });
  },
};
