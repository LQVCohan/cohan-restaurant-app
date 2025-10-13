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
    const menu = await Menu.findOne({ restaurantId, timeSlot }).lean({
      virtuals: true,
    });
    if (!menu) return [];
    const q = { restaurantId, menuId: menu._id };
    if (categoryId) q.categoryId = categoryId;
    if (search) q.name = new RegExp(search, "i");
    return MenuItem.find(q)
      .limit(limit)
      .sort({ name: 1 })
      .lean({ virtuals: true });
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

    // Price range: bao quát cả basePrice và preparationMethods.price
    const hasMin = typeof filter.minPrice === "number";
    const hasMax = typeof filter.maxPrice === "number";
    if (hasMin || hasMax) {
      const basePriceCond = {};
      const prepCond = {};
      if (hasMin) {
        basePriceCond.$gte = filter.minPrice;
        prepCond.$gte = filter.minPrice;
      }
      if (hasMax) {
        basePriceCond.$lte = filter.maxPrice;
        prepCond.$lte = filter.maxPrice;
      }
      q.$and = (q.$and || []).concat([
        {
          $or: [
            { basePrice: basePriceCond },
            { preparationMethods: { $elemMatch: { price: prepCond } } },
          ],
        },
      ]);
    }

    // Cursor
    const cId = cursor && toObj(cursor);
    if (cId) q._id = { ...(q._id || {}), $gt: cId };

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
};
