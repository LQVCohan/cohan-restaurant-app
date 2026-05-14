// src/graphql/resolvers/cart/index.js
import { CartQuery } from "./query.js";
import { CartMutation } from "./mutation.js";
import { CartAvailabilityWatchMutation } from "./availabilityWatchMutation.js";
import {
  CartFieldResolvers,
  CartItemFieldResolvers,
  MenuAvailabilityWatchFieldResolvers,
} from "./types.js";

export default {
  Query: {
    ...CartQuery,
  },
  Mutation: {
    ...CartMutation,
    ...CartAvailabilityWatchMutation,
  },

  Cart: {
    ...CartFieldResolvers,
  },
  CartItem: {
    ...CartItemFieldResolvers,
  },
  MenuAvailabilityWatch: {
    ...MenuAvailabilityWatchFieldResolvers,
  },
};