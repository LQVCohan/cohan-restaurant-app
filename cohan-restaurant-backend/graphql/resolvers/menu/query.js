// src/graphql/resolvers/menu/query.js (CLEAN + aligned with Recipe-as-source-of-truth)
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Menu, MenuItem, Category } from "../../../models/index.js";

const toObjectIdOrNull = (id) => {
  try {
    return mongoose.isValidObjectId(id)
      ? new mongoose.Types.ObjectId(String(id))
      : null;
  } catch {
    return null;
  }
};

export const MenuQuery = {
  menus: async (_p, { restaurantId }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];
    return Menu.find({ restaurantId })
      .sort({ timeSlot: 1 })
      .lean({ virtuals: true });
  },

  menu: async (_p, { restaurantId, timeSlot }) => {
    if (!mongoose.isValidObjectId(restaurantId)) return null;
    return Menu.findOne({ restaurantId, timeSlot }).lean({ virtuals: true });
  },

  // Note: menuItems here returns MenuItem only (no recipe populate).
  // Recipe/servingVariants should be fetched via inventory.menuItemsWithRecipes or type resolvers.
  menuItems: async (
    _p,
    { restaurantId, timeSlot, categoryId, search, limit = 50 }
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const q = { restaurantId };

    if (timeSlot) {
      const menu = await Menu.findOne({ restaurantId, timeSlot })
        .select({ _id: 1 })
        .lean();
      if (!menu) return [];
      q.menuId = menu._id;
    }

    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      q.categoryId = categoryId;
    }

    if (search?.trim()) {
      q.name = new RegExp(search.trim(), "i");
    }

    const safeLimit = Math.min(Math.max(limit || 50, 1), 500);

    return MenuItem.find(q)
      .sort({ name: 1 })
      .limit(safeLimit)
      .lean({ virtuals: true });
  },

  menuItemsConnection: async (_p, { limit = 20, cursor, filter }) => {
    if (!filter || !filter.restaurantId) {
      throw new GraphQLError("filter.restaurantId is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }
    if (!mongoose.isValidObjectId(filter.restaurantId)) {
      return {
        edges: [],
        pageInfo: { endCursor: null, hasNextPage: false },
      };
    }

    const q = { restaurantId: filter.restaurantId };

    // timeSlot -> menuId
    if (filter.timeSlot) {
      const m = await Menu.findOne({
        restaurantId: filter.restaurantId,
        timeSlot: filter.timeSlot,
      })
        .select({ _id: 1 })
        .lean();

      if (!m) {
        return {
          edges: [],
          pageInfo: { endCursor: null, hasNextPage: false },
        };
      }
      q.menuId = m._id;
    }

    if (filter.categoryId && mongoose.isValidObjectId(filter.categoryId)) {
      q.categoryId = filter.categoryId;
    }

    if (filter.status) q.status = filter.status;

    if (filter.search && filter.search.trim()) {
      const s = filter.search.trim();
      q.$or = [
        { name: new RegExp(s, "i") },
        { description: new RegExp(s, "i") },
      ];
    }

    // Price range: filter by MenuItem.basePrice (cached min variant price)
    const hasMin = typeof filter.minPrice === "number";
    const hasMax = typeof filter.maxPrice === "number";
    if (hasMin || hasMax) {
      const cond = {};
      if (hasMin) cond.$gte = filter.minPrice;
      if (hasMax) cond.$lte = filter.maxPrice;
      q.$and = (q.$and || []).concat([{ basePrice: cond }]);
    }

    // Cursor-based pagination by _id ascending
    const cId = cursor ? toObjectIdOrNull(cursor) : null;
    if (cId) q._id = { $gt: cId };

    const safeLimit = Math.min(Math.max(limit || 20, 1), 200);

    const docs = await MenuItem.find(q)
      .sort({ _id: 1 })
      .limit(safeLimit + 1)
      .lean({ virtuals: true });

    const hasNextPage = docs.length > safeLimit;
    const slice = hasNextPage ? docs.slice(0, safeLimit) : docs;

    return {
      edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
      pageInfo: {
        endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
        hasNextPage,
      },
    };
  },

  topMenuItems: async (
    _p,
    { limit = 8, restaurantId, categoryId, categoryName, timeSlot }
  ) => {
    const LIM = Math.min(Math.max(limit, 1), 200);

    const q = {};
    if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
      q.restaurantId = restaurantId;
    }

    if (timeSlot) {
      const menuFilter = { timeSlot };
      if (q.restaurantId) {
        menuFilter.restaurantId = q.restaurantId;
      }

      const menus = await Menu.find(menuFilter).select({ _id: 1 }).lean();
      if (!menus.length) return [];

      q.menuId = { $in: menus.map((menu) => menu._id) };
    }

    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      q.categoryId = categoryId;
    } else if (categoryName?.trim()) {
      const categoryFilter = {
        name: new RegExp(`^${categoryName.trim()}$`, "i"),
      };
      const matchedCategories = await Category.find(categoryFilter)
        .select({ _id: 1 })
        .lean();

      const matchedIds = matchedCategories.map((c) => c._id);
      if (!matchedIds.length) return [];

      q.categoryId = { $in: matchedIds };
    }

    return MenuItem.find(q)
      .sort({ point: -1, createdAt: -1, _id: 1 })
      .limit(LIM)
      .lean({ virtuals: true });
  },
};
