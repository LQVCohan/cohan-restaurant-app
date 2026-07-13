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
import { withCheckoutContactGuard } from "./checkoutContactGuard.js";
import { withDeferredOnlineCheckout } from "./deferredOnlineCheckout.js";
import publicTableSessionQuery from "./publicTableSessionQuery.js";
import publicTableSessionQueryEnhanced from "./publicTableSessionQueryEnhanced.js";
import publicTableOrderMutation from "./publicTableOrderMutation.js";
import {
  PublicTableOrderAccessMutation,
  PublicTableOrderAccessQuery,
} from "./publicTableOrderAccess.js";
import {
  withTableCustomerRequestMutations,
  withTableCustomerRequestQuery,
} from "./tableCustomerRequestBridge.js";

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
const CanonicalCheckoutOrderMutation = {
  ...HardenedOrderMutation,
  createCheckoutOrders: LifecycleOrderMutation.createCheckoutOrders,
};
const DeferredOnlineOrderMutation = withDeferredOnlineCheckout(
  CanonicalCheckoutOrderMutation,
);
const ContactGuardedOrderMutation = withCheckoutContactGuard(
  DeferredOnlineOrderMutation,
);
const CheckoutSafeOrderMutation = withCheckoutIdempotency(
  ContactGuardedOrderMutation,
);
const GuardedOrderMutation = withOrderRestaurantAccessGuards(CheckoutSafeOrderMutation);
const TableRequestOrderMutation = withTableCustomerRequestMutations(GuardedOrderMutation);

const CanonicalOrderQuery = { ...OrderQuery };
delete CanonicalOrderQuery.managerDashboard;
const TableRequestOrderQuery = withTableCustomerRequestQuery(CanonicalOrderQuery);

export default {
  Query: {
    ...TableRequestOrderQuery,
    ...OrderCoreRecoveryQuery,
    ...publicTableSessionQuery,
    ...publicTableSessionQueryEnhanced,
    ...CustomerOrderHistoryQuery,
    ...PublicTableOrderAccessQuery,
  },
  Mutation: {
    ...TableRequestOrderMutation,
    ...OrderProofMutation,
    ...CustomerOrderHistoryMutation,
    ...publicTableOrderMutation,
    ...PublicTableOrderAccessMutation,
  },
  Subscription: {
    ...OrderSubscription,
  },
  ...OrderResolvers,
};
