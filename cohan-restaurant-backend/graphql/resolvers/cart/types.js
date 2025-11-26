// src/graphql/resolvers/cart/types.js
import { User, Restaurant, MenuItem } from "../../../models/index.js";

export const CartFieldResolvers = {
  user: async (parent) => {
    if (!parent.userId) return null;
    return User.findById(parent.userId).lean({ virtuals: true });
  },

  totalQuantity: (parent) => {
    if (typeof parent.totalQuantity === "number") return parent.totalQuantity;
    const items = Array.isArray(parent.items) ? parent.items : [];
    return items.reduce((sum, i) => sum + (Number(i?.quantity) || 0), 0);
  },

  totalPrice: (parent) => {
    if (typeof parent.totalPrice === "number") return parent.totalPrice;
    const items = Array.isArray(parent.items) ? parent.items : [];
    return items.reduce(
      (sum, i) => sum + (Number(i?.price) || 0) * (Number(i?.quantity) || 0),
      0
    );
  },
};

export const CartItemFieldResolvers = {
  id: (parent) => (parent._id ? String(parent._id) : null),

  restaurant: async (parent) => {
    if (!parent.restaurantId) return null;
    return Restaurant.findById(parent.restaurantId).lean({ virtuals: true });
  },

  menuItem: async (parent) => {
    if (!parent.menuItemId) return null;
    return MenuItem.findById(parent.menuItemId).lean({ virtuals: true });
  },
};
