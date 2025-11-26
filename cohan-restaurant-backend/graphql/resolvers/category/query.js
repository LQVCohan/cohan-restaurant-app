// src/graphql/resolvers/category/query.js
import mongoose from "mongoose";
import { Category, Menu, MenuItem } from "../../../models/index.js";

export const CategoryQuery = {
  // ============================
  // Lấy tất cả category + kèm số lượng món
  // ============================
  categories: async (_, { restaurantId, timeSlot }) => {
    // 1) Lấy danh sách category
    const categories = await Category.find({ restaurantId, timeSlot })
      .sort({ order: 1, name: 1 })
      .lean({ virtuals: true });

    if (!categories.length)
      return categories.map((c) => ({ ...c, menuItemCount: 0 }));

    // 2) Tìm menu tương ứng với (restaurantId, timeSlot)
    const menu = await Menu.findOne({ restaurantId, timeSlot }).lean();
    if (!menu) {
      // Không có menu => không có món
      return categories.map((c) => ({ ...c, menuItemCount: 0 }));
    }

    // 3) Aggregate MenuItem để đếm số món theo category
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
        $group: {
          _id: "$categoryId",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = counts.reduce((acc, cur) => {
      acc[String(cur._id)] = cur.count;
      return acc;
    }, {});

    // 4) Gắn menuItemCount vào từng category
    return categories.map((cat) => ({
      ...cat,
      menuItemCount: countMap[String(cat._id)] || 0,
    }));
  },

  // ============================
  // Lấy N category có nhiều món nhất (default 6)
  // ============================
  topCategoriesByMenuItemCount: async (
    _,
    { restaurantId, timeSlot, limit = 6 }
  ) => {
    // 1) Tìm menu tương ứng (restaurantId, timeSlot)
    const menu = await Menu.findOne({ restaurantId, timeSlot }).lean();
    if (!menu) return [];

    const restaurantObjectId =
      typeof restaurantId === "string"
        ? new mongoose.Types.ObjectId(restaurantId)
        : restaurantId;

    // 2) Aggregate để đếm số món theo category cho menu này
    const counts = await MenuItem.aggregate([
      {
        $match: {
          restaurantId: restaurantObjectId,
          menuId: menu._id,
        },
      },
      {
        $group: {
          _id: "$categoryId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } }, // nhiều món -> ít món
      { $limit: limit }, // lấy tối đa N category
    ]);

    if (!counts.length) return [];

    const categoryIds = counts.map((c) => c._id);

    // 3) Lấy thông tin Category tương ứng
    const categories = await Category.find({
      _id: { $in: categoryIds },
      restaurantId,
      timeSlot,
    }).lean({ virtuals: true });

    const categoryMap = new Map(categories.map((c) => [String(c._id), c]));

    // 4) Trả về đúng thứ tự theo counts (đã sort theo count)
    return counts
      .map((c) => {
        const base = categoryMap.get(String(c._id));
        if (!base) return null;
        return {
          ...base,
          menuItemCount: c.count,
        };
      })
      .filter(Boolean);
  },
  topGlobalCategoriesByMenuItemCount: async (_, { timeSlot, limit = 6 }) => {
    // 1) Lấy tất cả menu (có thể filter theo timeSlot nếu truyền vào)
    const menuFilter = {};
    if (timeSlot) {
      menuFilter.timeSlot = timeSlot;
    }

    const menus = await Menu.find(menuFilter, { _id: 1 }).lean();
    if (!menus.length) return [];

    const menuIds = menus.map((m) => m._id);

    // 2) Aggregate MenuItem theo categoryId cho tất cả menu
    const counts = await MenuItem.aggregate([
      {
        $match: {
          menuId: { $in: menuIds },
        },
      },
      {
        $group: {
          _id: "$categoryId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    if (!counts.length) return [];

    const categoryIds = counts.map((c) => c._id);

    // 3) Lấy thông tin Category tương ứng
    const categoryFilter = { _id: { $in: categoryIds } };
    if (timeSlot) {
      categoryFilter.timeSlot = timeSlot;
    }

    const categories = await Category.find(categoryFilter).lean({
      virtuals: true,
    });

    const categoryMap = new Map(categories.map((c) => [String(c._id), c]));

    // 4) Map lại theo thứ tự counts + gắn menuItemCount
    return counts
      .map((c) => {
        const base = categoryMap.get(String(c._id));
        if (!base) return null;
        return {
          ...base,
          menuItemCount: c.count,
        };
      })
      .filter(Boolean);
  },
};
