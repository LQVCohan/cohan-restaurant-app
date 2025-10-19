// src/graphql/resolvers/index.js
import baseResolvers from "./base.js";
import role from "./role/index.js";
import restaurant from "./restaurant/index.js";
import user from "./user/index.js";
import permission from "./permission/index.js";
import menu from "./menu/index.js";
import category from "./category/index.js";
import modifierGroup from "./modifier/index.js";
import table from "./table/index.js";
import floor from "./floor/index.js";
import auth from "./auth/index.js";
import order from "./order/index.js";
import reservation from "./reservation/index.js";
// 🆕 Import thêm module quản lý kho, nguyên liệu, recipe, consumption
import inventory from "./inventory/index.js";

export default {
  ...baseResolvers,

  Query: {
    ...(role.Query || {}),
    ...(restaurant.Query || {}),
    ...(user.Query || {}),
    ...(permission.Query || {}),
    ...(menu.Query || {}),
    ...(category.Query || {}),
    ...(modifierGroup.Query || {}),
    ...(table.Query || {}),
    ...(floor.Query || {}),
    ...(order.Query || {}),
    ...(inventory.Query || {}),
    ...(reservation.Query || {}),
  },

  Mutation: {
    ...(role.Mutation || {}),
    ...(restaurant.Mutation || {}),
    ...(user.Mutation || {}),
    ...(permission.Mutation || {}),
    ...(category.Mutation || {}),
    ...(menu.Mutation || {}),
    ...(modifierGroup.Mutation || {}),
    ...(table.Mutation || {}),
    ...(floor.Mutation || {}),
    ...(inventory.Mutation || {}),
    ...(auth.Mutation || {}),
    ...(order.Mutation || {}),
    ...(reservation.Mutation || {}),
  },

  // Nếu bạn có type-level resolvers (giữ nguyên logic)
  ...(role.Role ? { Role: role.Role } : {}),
  ...(restaurant.Restaurant ? { Restaurant: restaurant.Restaurant } : {}),
  ...(user.User ? { User: user.User } : {}),
  ...(permission.Permission ? { Permission: permission.Permission } : {}),
  ...(menu.Menu ? { Menu: menu.Menu } : {}),
  ...(category.Category ? { Category: category.Category } : {}),
  ...(modifierGroup.Modifier ? { Modifier: modifierGroup.Modifier } : {}),
  ...(inventory.Inventory ? { Inventory: inventory.Inventory } : {}), // optional
};
