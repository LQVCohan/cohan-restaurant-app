// src/graphql/resolvers/menu/query.js
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
};
