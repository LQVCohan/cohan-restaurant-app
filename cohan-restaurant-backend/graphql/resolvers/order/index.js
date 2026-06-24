// src/graphql/order/index.js

import { OrderQuery } from "./query.js";
import { OrderCoreRecoveryQuery } from "./queryCoreRecovery.js";
import { OrderMutation } from "./mutation.js";
import { CustomerTrackingPaymentMutation } from "./customerTrackingPaymentMutation.js";
import { OrderProofMutation } from "./orderProofMutation.js";
import { withOrderRestaurantAccessGuards } from "./accessGuard.js";
import { OrderResolvers } from "./types.js";
import { OrderSubscription } from "./subscription.js";
import { withTablePaymentRequestLifecycle } from "./tablePaymentRequestLifecycle.js";
import { withOrderConflictHardening } from "./orderConflictHardening.js";
import { withCheckoutIdempotency } from "./checkoutIdempotency.js";
import publicTableSessionQuery from "./publicTableSessionQuery.js";

const PaymentGuardedOrderMutation = {
  ...OrderMutation,
  ...CustomerTrackingPaymentMutation,
};
const LifecycleOrderMutation = withTablePaymentRequestLifecycle(PaymentGuardedOrderMutation);
const HardenedOrderMutation = withOrderConflictHardening(LifecycleOrderMutation);
const CheckoutSafeOrderMutation = withCheckoutIdempotency(HardenedOrderMutation);
const GuardedOrderMutation = withOrderRestaurantAccessGuards(CheckoutSafeOrderMutation);

export default {
  Query: {
    ...OrderQuery,
    ...OrderCoreRecoveryQuery,
    ...publicTableSessionQuery,
  },
  Mutation: {
    ...GuardedOrderMutation,
    ...OrderProofMutation,
  },
  Subscription: {
    ...OrderSubscription,
  },
  ...OrderResolvers,
};
