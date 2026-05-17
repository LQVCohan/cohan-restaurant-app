import mongoose from "mongoose";
import {
  Category,
  CategoryMenu,
  Menu,
  MenuItem,
  RestaurantCategoryIndex,
  Order,
  Reservation,
  TableCustomer,
} from "../../../models/index.js";
import { requireRestaurantAccess } from "../../guards.js";

const TOP_DISH_SAMPLE = 1000;

async function refreshRestaurantCategoryIndexes(timeSlot) {
  if (!timeSlot) return;

  const menus = await Menu.find({ timeSlot }).select({ _id: 1, restaurantId: 1 }).lean();
  if (!menus.length) return;

  const menuIds = menus.map((m) => m._id);
  const menuById = new Map(menus.map((m) => [String(m._id), String(m.restaurantId)]));

  const grouped = await MenuItem.aggregate([
    { $match: { menuId: { $in: menuIds } } },
    {
      $group: {
        _id: { menuId: "$menuId", categoryId: "$categoryId", restaurantId: "$restaurantId" },
        menuItemCount: { $sum: 1 },
      },
    },
  ]);

  const byRestaurant = new Map();
  for (const row of grouped) {
    const restaurantId = String(row?._id?.restaurantId || menuById.get(String(row?._id?.menuId)) || "");
    if (!restaurantId) continue;

    if (!byRestaurant.has(restaurantId)) byRestaurant.set(restaurantId, []);
    byRestaurant.get(restaurantId).push({
      categoryId: row._id.categoryId,
      menuItemCount: row.menuItemCount,
    });
  }

  const orderRows = await Order.aggregate([
    { $match: { restaurantId: { $in: [...byRestaurant.keys()].map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: "$restaurantId", count: { $sum: 1 } } },
  ]);
  const reservationRows = await Reservation.aggregate([
    { $match: { restaurantId: { $in: [...byRestaurant.keys()].map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: "$restaurantId", count: { $sum: 1 } } },
  ]);
  const tableRows = await TableCustomer.aggregate([
    { $match: { restaurantId: { $in: [...byRestaurant.keys()].map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: "$restaurantId", count: { $sum: 1 } } },
  ]);

  const orderMap = new Map(orderRows.map((x) => [String(x._id), x.count]));
  const reservationMap = new Map(reservationRows.map((x) => [String(x._id), x.count]));
  const tableMap = new Map(tableRows.map((x) => [String(x._id), x.count]));

  const ops = [];
  for (const [restaurantId, categories] of byRestaurant.entries()) {
    const categoryIds = [...new Set(categories.map((c) => String(c.categoryId)))].map(
      (id) => new mongoose.Types.ObjectId(id)
    );

    ops.push({
      updateOne: {
        filter: {
          restaurantId: new mongoose.Types.ObjectId(restaurantId),
          timeSlot,
        },
        update: {
          $set: {
            categoryIds,
            categories,
            distinctCategoryCount: categoryIds.length,
            orderCount: orderMap.get(restaurantId) || 0,
            reservationCount: reservationMap.get(restaurantId) || 0,
            tableParticipationCount: tableMap.get(restaurantId) || 0,
          },
        },
        upsert: true,
      },
    });
  }

  if (ops.length) {
    await RestaurantCategoryIndex.bulkWrite(ops, { ordered: false });
  }
}


const buildPublicMenuItemMatch = (restaurantObjectId, menuId) => ({
  restaurantId: restaurantObjectId,
  menuId,
  status: "available",
});

export const CategoryQuery = {
  customerMenuCategories: async (_, { restaurantId, timeSlot }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    const restaurantObjectId =
      typeof restaurantId === "string"
        ? new mongoose.Types.ObjectId(restaurantId)
        : restaurantId;

    const menu = await Menu.findOne({ restaurantId, timeSlot, isActive: true }).lean();
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
        $match: buildPublicMenuItemMatch(restaurantObjectId, menu._id),
      },
      {
        $group: { _id: "$categoryId", count: { $sum: 1 } },
      },
    ]);

    const countMap = counts.reduce((acc, cur) => {
      acc[String(cur._id)] = cur.count;
      return acc;
    }, {});

    return categories
      .filter((cat) => (countMap[String(cat._id)] || 0) > 0)
      .map((cat) => ({
        ...cat,
        timeSlot: timeSlot || null,
        menuItemCount: countMap[String(cat._id)] || 0,
      }));
  },

  categories: async (_, { restaurantId, timeSlot }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);
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
    if (!menu) return categories.map((c) => ({ ...c, menuItemCount: c.menuItemCount || 0 }));

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
  , ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);
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
      .limit(TOP_DISH_SAMPLE)
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

    const rows = topCategoryIds
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

    if (rows.length) {
      await Category.bulkWrite(
        rows.map((r) => ({
          updateOne: {
            filter: { _id: r._id || r.id },
            update: { $set: { menuItemCount: r.menuItemCount } },
          },
        })),
        { ordered: false }
      );
    }

    return rows;
  },

  topGlobalCategoriesByMenuItemCount: async (_, { timeSlot, limit = 6 }) => {
    if (timeSlot) {
      await refreshRestaurantCategoryIndexes(timeSlot);
    }

    const topDishesFilter = {};
    if (timeSlot) {
      const menus = await Menu.find({ timeSlot }).select({ _id: 1 }).lean();
      if (!menus.length) return [];
      topDishesFilter.menuId = { $in: menus.map((m) => m._id) };
    }

    const topDishes = await MenuItem.find(topDishesFilter)
      .select({ _id: 1, categoryId: 1, restaurantId: 1 })
      .sort({ rate: -1, orderCounter: -1, createdAt: -1, _id: 1 })
      .limit(TOP_DISH_SAMPLE)
      .lean();

    if (!topDishes.length) return [];

    const rows = await RestaurantCategoryIndex.find({
      ...(timeSlot ? { timeSlot } : {}),
      categoryIds: { $exists: true, $ne: [] },
    }).lean();

    if (!rows.length) return [];

    const scoreByCategoryKey = new Map();

    for (const row of rows) {
      for (const cat of row.categories || []) {
        const key = `${row.restaurantId}:${cat.categoryId}`;
        scoreByCategoryKey.set(key, (scoreByCategoryKey.get(key) || 0) + (cat.menuItemCount || 0));
      }
    }

    const sorted = [...scoreByCategoryKey.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    const categoryIds = sorted.map(([k]) => k.split(":")[1]);
    const categories = await Category.find({ _id: { $in: categoryIds } }).lean();
    const catMap = new Map(categories.map((c) => [String(c._id), c]));

    return sorted
      .map(([k, count]) => {
        const [restaurantId, categoryId] = k.split(":");
        const base = catMap.get(categoryId);
        if (!base) return null;
        return {
          id: String(base._id),
          _id: base._id,
          restaurantId,
          timeSlot: timeSlot || null,
          name: base.name,
          menuItemCount: count,
          isActive: base.isActive,
        };
      })
      .filter(Boolean);
  },

  categoryMenus: async (_, { restaurantId }, ctx) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    await requireRestaurantAccess(ctx, restaurantId);
    return CategoryMenu.find({ restaurantId })
      .sort({ name: 1 })
      .lean({ virtuals: true });
  },

  categoryMenu: async (_, { id }, ctx) => {
    if (!mongoose.isValidObjectId(id)) return null;
    const existing = await CategoryMenu.findById(id).select({ restaurantId: 1 }).lean();
    if (!existing) return null;
    await requireRestaurantAccess(ctx, existing.restaurantId);
    return CategoryMenu.findById(id).lean({ virtuals: true });
  },
};
