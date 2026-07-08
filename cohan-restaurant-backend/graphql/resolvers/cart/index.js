import { CartQuery } from "./query.js";
import { CustomerCartQuery } from "./customerQuery.js";
import { CartMutation } from "./mutation.js";
import { CustomerCartMutation } from "./customerMutation.js";
import { CartAvailabilityWatchMutation } from "./availabilityWatchMutation.js";
import {
  CartFieldResolvers,
  CartItemFieldResolvers,
  MenuAvailabilityWatchFieldResolvers,
} from "./types.js";

export default {
  Query: {
    ...CartQuery,
    ...CustomerCartQuery,
  },
  Mutation: {
    ...CartMutation,
    ...CustomerCartMutation,
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
