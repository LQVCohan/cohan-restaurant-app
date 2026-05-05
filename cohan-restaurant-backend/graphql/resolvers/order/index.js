// src/graphql/order/index.js

import { OrderQuery } from "./query.js";
import { OrderMutation } from "./mutation.js";
import { withOrderRestaurantAccessGuards } from "./accessGuard.js";
import { OrderResolvers } from "./types.js";
import { OrderSubscription } from "./subscription.js";

const GuardedOrderMutation = withOrderRestaurantAccessGuards(OrderMutation);

export default {
  Query: {
    ...OrderQuery,
  },
  Mutation: {
    ...GuardedOrderMutation,
  },
  Subscription: {
    ...OrderSubscription,
  },
  ...OrderResolvers,
};
