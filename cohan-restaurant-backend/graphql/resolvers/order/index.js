// src/graphql/order/index.js

import { OrderQuery } from "./query.js";
import { OrderCoreRecoveryQuery } from "./queryCoreRecovery.js";
import { OrderMutation } from "./mutation.js";
import { CustomerTrackingPaymentMutation } from "./customerTrackingPaymentMutation.js";
import { OrderProofMutation } from "./orderProofMutation.js";
import {
  CustomerOrderHistoryMutation,
  CustomerOrderHistoryQuery,
} from "./customerHistory.js";
import { withOrderRestaurantAccessGuards } from "./accessGuard.js";
import { OrderResolvers } from "./types.js";
import { OrderSubscription } from "./subscription.js";
import { withMergedTableOrderLifecycle } from "./mergedTableLifecycle.js";
import { withTableCustomerOrderLifecycle } from "./tableCustomerOrderLifecycle.js";
import { withTablePaymentRequestLifecycle } from "./tablePaymentRequestLifecycle.js";
import { withOrderConflictHardening } from "./orderConflictHardening.js";
import { withCheckoutIdempotency } from "./checkoutIdempotency.js";
import publicTableSessionQuery from "./publicTableSessionQuery.js";
import publicTableOrderMutation from "./publicTableOrderMutation.js";

const PaymentGuardedOrderMutation = {
  ...OrderMutation,
  ...CustomerTrackingPaymentMutation,
};
const TableCustomerOrderMutation = withTableCustomerOrderLifecycle(
  PaymentGuardedOrderMutation,
);
const MergedTableOrderMutation = withMergedTableOrderLifecycle(
  TableCustomerOrderMutation,
);
const LifecycleOrderMutation = withTablePaymentRequestLifecycle(
  MergedTableOrderMutation,
);
const HardenedOrderMutation = withOrderConflictHardening(LifecycleOrderMutation);
const CheckoutSafeOrderMutation = withCheckoutIdempotency(HardenedOrderMutation);
const GuardedOrderMutation = withOrderRestaurantAccessGuards(CheckoutSafeOrderMutation);

const CanonicalOrderQuery = { ...OrderQuery };
delete CanonicalOrderQuery.managerDashboard;

export default {
  Query: {
    ...CanonicalOrderQuery,
    ...OrderCoreRecoveryQuery,
    ...publicTableSessionQuery,
    ...CustomerOrderHistoryQuery,
  },
  Mutation: {
    ...GuardedOrderMutation,
    ...OrderProofMutation,
    ...CustomerOrderHistoryMutation,
    ...publicTableOrderMutation,
  },
  Subscription: {
    ...OrderSubscription,
  },
  ...OrderResolvers,
};
