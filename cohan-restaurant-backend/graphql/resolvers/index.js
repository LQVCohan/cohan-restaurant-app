import baseResolvers from "./base.js";
import role from "./role/index.js";
import restaurant from "./restaurant/index.js";
import user from "./user/index.js";
import permission from "./permission/index.js";
import menu from "./menu/index.js";
import category from "./category/index.js";
import modifierGroup from "./modifier/index.js";
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
  },
  Mutation: {
    ...(role.Mutation || {}),
    ...(restaurant.Mutation || {}),
    ...(user.Mutation || {}),
    ...(permission.Mutation || {}),
    ...(category.Mutation || {}),
    ...(menu.Mutation || {}),
    ...(modifierGroup.Mutation || {}),
  },
  // nếu bạn có type-level resolvers:
  ...(role.Role ? { Role: role.Role } : {}),
  ...(restaurant.Restaurant ? { Restaurant: restaurant.Restaurant } : {}),
  ...(user.User ? { User: user.User } : {}),
  ...(permission.Permission ? { Permission: permission.Permission } : {}),
  ...(menu.Menu ? { Menu: menu.Menu } : {}),
  ...(category.Category ? { Category: category.Category } : {}),
  ...(modifierGroup.Modifier ? { Modifier: modifierGroup.Modifier } : {}),
};
