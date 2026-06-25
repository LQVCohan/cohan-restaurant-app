// src/graphql/order/resolvers.js
import { User } from "../../../models/index.js";

export const OrderResolvers = {
  Order: {
    id(parent) {
      const value = parent?.id || parent?._id;
      return value ? String(value) : null;
    },

    async user(parent) {
      if (!parent.userId) return null;
      return User.findById(parent.userId).lean();
    },
  },
};
