import { MenuItem, Restaurant, User } from "../../../models/index.js";
import {
  computeCartTotalAmount,
  resolveCartRestaurantId,
} from "../../../models/cartDerivedFields.js";

export const CartFieldResolvers = {
  user: async (parent) => {
    if (!parent.userId) return null;
    return User.findById(parent.userId).lean({ virtuals: true });
  },

  restaurantId: (parent) => {
    if (parent?.restaurantId) return parent.restaurantId;
    const items = Array.isArray(parent.items) ? parent.items : [];
    return resolveCartRestaurantId(items);
  },

  totalQuantity: (parent) => {
    if (typeof parent.totalQuantity === "number") return parent.totalQuantity;
    const items = Array.isArray(parent.items) ? parent.items : [];
    return items.reduce(
      (sum, item) => sum + (Number(item?.quantity) || 0),
      0,
    );
  },

  totalAmount: (parent) => {
    const items = Array.isArray(parent.items) ? parent.items : [];
    return computeCartTotalAmount(items);
  },

  totalPrice: (parent) => {
    const items = Array.isArray(parent.items) ? parent.items : [];
    return computeCartTotalAmount(items);
  },
};

export const CartItemFieldResolvers = {
  id: (parent) =>
    parent?._id ? String(parent._id) : parent?.id ? String(parent.id) : null,

  itemType: (parent) => String(parent?.itemType || "MENU_ITEM"),

  servingVariantKey: (parent) => {
    const key = String(
      parent?.servingKey || parent?.servingVariantKey || "",
    ).trim();
    return key || "portion";
  },

  modifiers: (parent) =>
    Array.isArray(parent?.modifiers) ? parent.modifiers : [],

  modifiersPrice: (parent) => Number(parent?.modifiersPrice || 0),

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
  id: (parent) =>
    parent?._id ? String(parent._id) : parent?.id || null,
};
