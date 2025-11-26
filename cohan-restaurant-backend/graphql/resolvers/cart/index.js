// src/graphql/resolvers/cart/index.js
import { CartQuery } from "./query.js";
import { CartMutation } from "./mutation.js";
import { CartFieldResolvers, CartItemFieldResolvers } from "./types.js";

export default {
  Query: {
    ...CartQuery,
  },
  Mutation: {
    ...CartMutation,
  },

  Cart: {
    ...CartFieldResolvers,
  },
  CartItem: {
    ...CartItemFieldResolvers,
  },
};
