# Transfer payment review integrity

## Current behavior and root cause

- The manager page is backed by `PaymentSession.transfer`, `transferPaymentQueue`, and the manual verify/reject mutations.
- The mutations authorize the restaurant but do not enforce that the current transfer state is still `SUBMITTED` or `VERIFYING`; a stale or direct GraphQL request can therefore act on rejected, failed, expired, or proof-less sessions.
- Manual verification accepts any positive received amount. A short payment can create a partial invoice while the order is still marked paid and released.
- Reusing a provider transaction ID can be treated as an idempotent settlement even when it belongs to another payment reference.
- Manual verification repeats order status/payment updates already performed by `settlePaidOrderPaymentSession`, producing duplicate pending timeline entries.
- Rejection writes the payment and related orders outside one transaction, so a failure can leave them in different states.
- Mutation errors are displayed behind the open decision modal, and the route allows `reconciliation.read` even though the queue resolver requires `payment.read`.

## End-to-end flow

1. `payment-session.model.js` persists transfer proof, status, received amount, variance, and reviewer metadata.
2. `paymentTransfer.graphql` exposes queue and decision inputs.
3. `bankTransferQuery.js` scopes queue reads by restaurant and `payment.read`.
4. `transferMutation.js` submits proof and performs manual verify/reject decisions.
5. `paymentSession.service.js` creates the transaction, invoice, cashflow, and releases orders.
6. `TransferPaymentReviewPage.jsx` shows the queue and invokes decisions.
7. `ManagerLayout.jsx` gates the route.

## Acceptance criteria

- Only `SUBMITTED` or `VERIFYING` transfers can be manually verified or rejected.
- Manual verification requires the received VND amount to exactly match the expected amount.
- A bank transaction reference cannot settle a different payment session.
- Verify and reject remain restaurant-scoped, audited, realtime-enabled, and transaction-safe.
- Manual verification relies on the shared settlement service and does not append a duplicate pending order update.
- Decision errors are visible inside the open modal.
- The route requires `payment.read`, matching the backend.
- Focused tests cover invalid state, amount mismatch, duplicate transaction reference, and modal validation.

## Out of scope

- Redesigning the already-polished dashboard.
- Changing customer retry limits, upload storage, gateway callbacks, reconciliation UI, or payment formulas.
- Adding pagination or dependencies.
