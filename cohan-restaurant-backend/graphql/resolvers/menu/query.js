// src/graphql/resolvers/menu/query.js
import mongoose from "mongoose";
import { GraphQLError } from "graphql";
import { Menu, MenuItem } from "../../../models/index.js";

export const MenuQuery = {
  menus: (_, { restaurantId }) =>
    Menu.find({ restaurantId }).sort({ timeSlot: 1 }).lean({ virtuals: true }),

  menu: (_, { restaurantId, timeSlot }) =>
    Menu.findOne({ restaurantId, timeSlot }).lean({ virtuals: true }),

  menuItems: async (
    _,
    { restaurantId, timeSlot, categoryId, search, limit = 50 }
  ) => {
    if (!mongoose.isValidObjectId(restaurantId)) return [];

    const q = { restaurantId };

    if (timeSlot) {
      const menu = await Menu.findOne({ restaurantId, timeSlot }).lean({
        virtuals: true,
      });
      if (!menu) return [];
      q.menuId = menu._id;
    }

    // Optional filters
    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      q.categoryId = categoryId;
    }
    if (search?.trim()) {
      q.name = new RegExp(search.trim(), "i");
    }

    const menuItems = await MenuItem.find(q)
      .limit(Math.min(limit ?? 50, 500))
      .sort({ name: 1 })
      .lean({ virtuals: true });
    console.log("menuItems[0] from Mongo:", menuItems[0]);
    // recipe (và servingVariants) sẽ được autoPopulate từ model + types resolver
    return menuItems;
  },

  menuItemsConnection: async (_, { limit = 20, cursor, filter }) => {
    if (!filter || !filter.restaurantId) {
      throw new GraphQLError("filter.restaurantId is required", {
        extensions: { code: "BAD_USER_INPUT" },
      });
    }

    const toObj = (id) =>
      mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(id) : null;

    // Xây filter chính cho MenuItem
    const q = { restaurantId: filter.restaurantId };

    // timeSlot -> menuId
    if (filter.timeSlot) {
      const m = await Menu.findOne({
        restaurantId: filter.restaurantId,
        timeSlot: filter.timeSlot,
      }).lean();
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

    // Price range: hiện tại chỉ filter theo basePrice
    const hasMin = typeof filter.minPrice === "number";
    const hasMax = typeof filter.maxPrice === "number";
    if (hasMin || hasMax) {
      const basePriceCond = {};
      if (hasMin) basePriceCond.$gte = filter.minPrice;
      if (hasMax) basePriceCond.$lte = filter.maxPrice;

      q.$and = (q.$and || []).concat([{ basePrice: basePriceCond }]);
    }

    // Cursor
    const cId = cursor && toObj(cursor);
    if (cId) q._id = { ...(q._id || {}), $gt: cId };

    console.log("info: ", q);

    const docs = await MenuItem.find(q)
      .sort({ _id: 1 })
      .limit(limit + 1)
      .lean({ virtuals: true });

    const hasNextPage = docs.length > limit;
    const slice = hasNextPage ? docs.slice(0, -1) : docs;

    return {
      edges: slice.map((d) => ({ node: d, cursor: String(d._id) })),
      pageInfo: {
        endCursor: slice.length ? String(slice[slice.length - 1]._id) : null,
        hasNextPage,
      },
    };
  },

  topMenuItems: async (_parent, { limit = 8, restaurantId, categoryId }) => {
    const LIM = Math.min(Math.max(limit, 1), 50); // 1..50

    const q = {};
    if (restaurantId && mongoose.isValidObjectId(restaurantId)) {
      q.restaurantId = new mongoose.Types.ObjectId(restaurantId);
    }
    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      q.categoryId = new mongoose.Types.ObjectId(categoryId);
    }

    const docs = await MenuItem.find(q)
      .sort({ point: -1, createdAt: -1, _id: 1 }) // ưu tiên point cao
      .limit(LIM)
      .lean({ virtuals: true });

    return docs;
  },
};
