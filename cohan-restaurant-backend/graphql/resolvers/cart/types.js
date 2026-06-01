// src/graphql/resolvers/cart/types.js
import { User, Restaurant, MenuItem } from "../../../models/index.js";
import { computeCartTotalAmount } from "../../../models/cartDerivedFields.js";

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

  totalAmount: (parent) => {
    if (typeof parent.totalAmount === "number") return parent.totalAmount;
    const items = Array.isArray(parent.items) ? parent.items : [];
    return computeCartTotalAmount(items);
  },

  totalPrice: (parent) => {
    if (typeof parent.totalPrice === "number") return parent.totalPrice;
    const items = Array.isArray(parent.items) ? parent.items : [];
    return computeCartTotalAmount(items);
  },
};

export const CartItemFieldResolvers = {
  id: (parent) => (parent._id ? String(parent._id) : null),

  servingVariantKey: (parent) => {
    const key = String(parent?.servingKey || parent?.servingVariantKey || "").trim();
    return key || "portion";
  },

  restaurant: async (parent) => {
    if (!parent.restaurantId) return null;
    return Restaurant.findById(parent.restaurantId).lean({ virtuals: true });
  },

  menuItem: async (parent) => {
    if (!parent.menuItemId) return null;
    return MenuItem.findById(parent.menuItemId).lean({ virtuals: true });
  },
};

export const MenuAvailabilityWatchFieldResolvers = {
  id: (parent) => (parent?._id ? String(parent._id) : parent?.id || null),
};
