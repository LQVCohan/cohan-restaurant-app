// src/graphql/order/index.js

import { OrderQuery } from "./query.js";
import { OrderMutation } from "./mutation.js";
import { withOrderRestaurantAccessGuards } from "./accessGuard.js";
import { OrderResolvers } from "./types.js";
import { OrderSubscription } from "./subscription.js";
import { withTablePaymentRequestLifecycle } from "./tablePaymentRequestLifecycle.js";
import publicTableSessionQuery from "./publicTableSessionQuery.js";

const LifecycleOrderMutation = withTablePaymentRequestLifecycle(OrderMutation);
const GuardedOrderMutation = withOrderRestaurantAccessGuards(LifecycleOrderMutation);

export default {
  Query: {
    ...OrderQuery,
    ...publicTableSessionQuery,
  },
  Mutation: {
    ...GuardedOrderMutation,
  },
  Subscription: {
    ...OrderSubscription,
  },
  ...OrderResolvers,
};
