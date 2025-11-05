// src/graphql/order/resolvers.js
import { User } from "../../../models/index.js";

export const OrderResolvers = {
  Order: {
    async user(parent) {
      if (!parent.userId) return null;
      return User.findById(parent.userId).lean();
    },
  },
};
