// src/graphql/order/index.js

import { OrderQuery } from "./query.js";
import { OrderMutation } from "./mutation.js";
import { withOrderRestaurantAccessGuards } from "./accessGuard.js";
import { OrderResolvers } from "./types.js";
import { OrderSubscription } from "./subscription.js";
import { withTablePaymentRequestLifecycle } from "./tablePaymentRequestLifecycle.js";
import { withOrderConflictHardening } from "./orderConflictHardening.js";
import publicTableSessionQuery from "./publicTableSessionQuery.js";

const LifecycleOrderMutation = withTablePaymentRequestLifecycle(OrderMutation);
const HardenedOrderMutation = withOrderConflictHardening(LifecycleOrderMutation);
const GuardedOrderMutation = withOrderRestaurantAccessGuards(HardenedOrderMutation);

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