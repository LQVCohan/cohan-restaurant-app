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
import inventory from "./inventory/index.js";
import supply from "./supply/index.js";
import eventLogResolvers from "./event_log/index.js";
import payment from "./payment/index.js";
import staff from "./staff/index.js";
import review from "./review/index.js";
import reviewComment from "./review_comment/index.js";
import cart from "./cart/index.js";

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
    ...(supply.Query || {}), // 🆕 Thêm Query supply
    ...(reservation.Query || {}),
    ...(eventLogResolvers.Query || {}),
    ...(payment.Query || {}),
    ...(staff.Query || {}),
    ...(review.Query || {}),
    ...(reviewComment.Query || {}),
    ...(cart.Query || {}), // 🆕 Thêm Query cart
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
    ...(supply.Mutation || {}), // 🆕 Thêm Mutation supply
    ...(auth.Mutation || {}),
    ...(order.Mutation || {}),
    ...(reservation.Mutation || {}),
    ...(eventLogResolvers.Mutation || {}),
    ...(payment.Mutation || {}),
    ...(staff.Mutation || {}),
    ...(review.Mutation || {}),
    ...(reviewComment.Mutation || {}),
    ...(cart.Mutation || {}), // 🆕 Thêm Mutation cart
  },

  // Nếu có type-level resolvers
  ...(role.Role ? { Role: role.Role } : {}),
  ...(restaurant.Restaurant ? { Restaurant: restaurant.Restaurant } : {}),
  ...(user.User ? { User: user.User } : {}),
  ...(permission.Permission ? { Permission: permission.Permission } : {}),
  ...(menu.Menu ? { Menu: menu.Menu } : {}),
  ...(category.Category ? { Category: category.Category } : {}),
  ...(modifierGroup.Modifier ? { Modifier: modifierGroup.Modifier } : {}),
  ...(inventory.IngredientsComponent
    ? { IngredientsComponent: inventory.IngredientsComponent }
    : {}),
  ...(supply.Supply ? { Supply: supply.Supply } : {}),
  ...(order.Order ? { Order: order.Order } : {}),

  ...(menu.MenuItem ? { MenuItem: menu.MenuItem } : {}),

  ...(cart.Cart ? { Cart: cart.Cart } : {}),
  ...(cart.CartItem ? { CartItem: cart.CartItem } : {}),
};
