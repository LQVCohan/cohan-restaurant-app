# Transfer payment review integrity

## Current behavior and root cause

- The manager page is backed by `PaymentSession.transfer`, `transferPaymentQueue`, and the manual verify/reject mutations.
- The mutations authorized the restaurant but did not enforce that the current transfer state was still `SUBMITTED` or `VERIFYING`; a stale or direct GraphQL request could therefore act on rejected, failed, expired, or proof-less sessions.
- Manual verification accepted any positive received amount. A short payment could create a partial invoice while the order was still marked paid and released.
- Reusing a provider transaction ID could be treated as an idempotent settlement even when it belonged to another payment reference.
- Manual verification repeated order status/payment updates already performed by `settlePaidOrderPaymentSession`, producing duplicate pending timeline entries.
- Rejection wrote the payment and related orders outside one transaction, so a failure could leave them in different states.
- Mutation errors were displayed behind the open decision modal.

## End-to-end flow

1. `payment-session.model.js` persists transfer proof, status, received amount, variance, and reviewer metadata.
2. `paymentTransfer.graphql` exposes queue and decision inputs.
3. `bankTransferQuery.js` scopes queue reads by restaurant and `payment.read`.
4. `transferMutation.js` submits proof and performs manual verify/reject decisions.
5. `paymentSession.service.js` creates the transaction, invoice, cashflow, and releases orders.
6. `TransferPaymentReviewPage.jsx` shows the queue and invokes decisions.

## Acceptance criteria

- Only `SUBMITTED` or `VERIFYING` transfers with proof can be manually verified or rejected.
- Manual verification requires the received VND amount to exactly match the expected amount.
- A bank transaction reference cannot settle a different payment session through the manual review flow.
- Verify and reject remain restaurant-scoped, audited, realtime-enabled, and transaction-safe.
- Manual verification relies on the shared settlement service and does not append a duplicate pending order update.
- Decision errors are visible inside the open modal.
- Existing `payment.read` and `payment.write` backend permission guards remain authoritative.
- Focused tests cover invalid state, amount mismatch, duplicate transaction reference, atomic rejection, and modal validation.

## Out of scope

- Redesigning the already-polished dashboard.
- Changing customer retry limits, upload storage, gateway callbacks, reconciliation UI, or payment formulas.
- Adding pagination or dependencies.
