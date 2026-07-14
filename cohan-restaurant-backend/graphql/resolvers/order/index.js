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
import { withComboCheckoutHoldCompatibility } from "./comboCheckoutHoldCompatibility.js";
import { withCheckoutIdempotency } from "./checkoutIdempotency.js";
import { withCheckoutContactGuard } from "./checkoutContactGuard.js";
import { withDeferredOnlineCheckout } from "./deferredOnlineCheckout.js";
import { withIncomingOrderProofGuard } from "./incomingOrderProofGuard.js";
import publicTableSessionQuery from "./publicTableSessionQuery.js";
import publicTableOrderMutation from "./publicTableOrderMutation.js";
import {
  PublicTableOrderAccessMutation,
  PublicTableOrderAccessQuery,
} from "./publicTableOrderAccess.js";
import {
  TableOrderSplitMutation,
  TableOrderSplitQuery,
} from "./tableOrderSplit.js";

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
  // ponytail: the canonical checkout resolver owns cart-hold validation and release.
  createCheckoutOrders: LifecycleOrderMutation.createCheckoutOrders,
};
const ComboCompatibleCheckoutOrderMutation =
  withComboCheckoutHoldCompatibility(CanonicalCheckoutOrderMutation);
const DeferredOnlineOrderMutation = withDeferredOnlineCheckout(
  ComboCompatibleCheckoutOrderMutation,
);
const ContactGuardedOrderMutation = withCheckoutContactGuard(
  DeferredOnlineOrderMutation,
);
const CheckoutSafeOrderMutation = withCheckoutIdempotency(
  ContactGuardedOrderMutation,
);
const ProofReadyOrderMutation = withIncomingOrderProofGuard(
  CheckoutSafeOrderMutation,
);
const GuardedOrderMutation = withOrderRestaurantAccessGuards(
  ProofReadyOrderMutation,
);

const CanonicalOrderQuery = { ...OrderQuery };
delete CanonicalOrderQuery.managerDashboard;

export default {
  Query: {
    ...CanonicalOrderQuery,
    ...OrderCoreRecoveryQuery,
    ...publicTableSessionQuery,
    ...CustomerOrderHistoryQuery,
    ...PublicTableOrderAccessQuery,
    ...TableOrderSplitQuery,
  },
  Mutation: {
    ...GuardedOrderMutation,
    ...OrderProofMutation,
    ...CustomerOrderHistoryMutation,
    ...publicTableOrderMutation,
    ...PublicTableOrderAccessMutation,
    ...TableOrderSplitMutation,
  },
  Subscription: {
    ...OrderSubscription,
  },
  ...OrderResolvers,
};
