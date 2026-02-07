import mongoose from "mongoose";
import {
  Category,
  CategoryMenu,
  Menu,
  MenuItem,
} from "../../../models/index.js";

export const CategoryQuery = {
  categories: async (_, { restaurantId, timeSlot }) => {
    const restaurantObjectId =
      typeof restaurantId === "string"
        ? new mongoose.Types.ObjectId(restaurantId)
        : restaurantId;

    const categories = await Category.find({ restaurantId: restaurantObjectId })
      .sort({ order: 1, name: 1 })
      .lean({ virtuals: true });

    if (!categories.length)
      return categories.map((c) => ({ ...c, menuItemCount: 0 }));

    const menu = await Menu.findOne({ restaurantId, timeSlot }).lean();
    if (!menu) return categories.map((c) => ({ ...c, menuItemCount: 0 }));

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

    const topMenuItems = await MenuItem.find({
      restaurantId: restaurantObjectId,
      menuId: menu._id,
    })
      .select({ categoryId: 1 })
      .sort({ rate: -1, orderCounter: -1, createdAt: -1, _id: 1 })
      .limit(1000)
      .lean();

    if (!topMenuItems.length) return [];

    const counter = new Map();
    for (const item of topMenuItems) {
      const key = String(item.categoryId);
      counter.set(key, (counter.get(key) || 0) + 1);
    }

    const topCategoryIds = [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    const categories = await Category.find({
      _id: { $in: topCategoryIds },
      restaurantId: restaurantObjectId,
    }).lean({ virtuals: true });

    const categoryMap = new Map(categories.map((c) => [String(c._id), c]));

    return topCategoryIds
      .map((id) => {
        const base = categoryMap.get(id);
        if (!base) return null;
        return {
          ...base,
          timeSlot: timeSlot || null,
          menuItemCount: counter.get(id) || 0,
        };
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
      .select({ _id: 1, categoryId: 1, restaurantId: 1 })
      .sort({ rate: -1, orderCounter: -1, createdAt: -1, _id: 1 })
      .limit(1000)
      .lean();

    if (!topDishes.length) return [];

    const grouped = await MenuItem.aggregate([
      {
        $match: {
          _id: { $in: topDishes.map((dish) => dish._id) },
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
        $match: {
          $expr: {
            $eq: ["$category.restaurantId", "$restaurantId"],
          },
        },
      },
      {
        $group: {
          _id: {
            restaurantId: "$restaurantId",
            categoryId: "$category._id",
            categoryName: "$category.name",
          },
          menuItemCount: { $sum: 1 },
        },
      },
      { $sort: { menuItemCount: -1 } },
      { $limit: limit },
    ]);

    return grouped.map((row) => ({
      id: String(row._id.categoryId),
      restaurantId: String(row._id.restaurantId),
      timeSlot: timeSlot || null,
      name: row._id.categoryName,
      menuItemCount: row.menuItemCount,
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
