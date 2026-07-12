# Design

## End-to-end flow

1. Apollo recognizes an active money mutation and generates one secure top-level `idempotencyKey` with Web Crypto.
2. The key is stored by operation plus canonical input fingerprint until the corresponding mutation returns success.
3. GraphQL validates that every active money-command input contains the key.
4. The final composed payment resolver map is wrapped after ownership, permission, merged-table, strict-payment, public-table, and transaction-management guards are assembled.
5. The wrapper calls `runIdempotentPaymentRequest`, which hashes operation, authenticated actor, optional restaurant, and canonical input with SHA-256.
6. `PaymentRequestLock` atomically claims the key. Existing claims must match operation, actor, restaurant, and fingerprint.
7. The original resolver executes once. Existing services continue to own pricing, provider creation, transaction settlement, invoice, cashflow, permissions, audit, realtime behavior, and provider callback verification.
8. The wrapper stores a JSON-safe completed result and correlation metadata. Exact retries return that result without calling the original resolver.
9. For an ambiguous failure, operation-specific recovery looks for the destination PaymentSession, PaymentTransaction, PaymentRefund, WalletTransaction, Invoice, or Cashflow.

## Claim lifecycle

- `PROCESSING`: one owner is executing.
- `COMPLETED`: exact retries return the stored result.
- `FAILED`: the same request may reclaim after destination recovery confirms no result committed.
- A processing claim waits briefly. A stale `PROCESSING` claim may recover a proven destination result, but is never automatically reclaimed; an unproven outcome returns `PAYMENT_IN_PROGRESS` to avoid double movement.
- Processing claims expire after the ambiguity window, failed claims after one day, and completed claims after ninety days.

## Operation recovery

- `CreateWalletTopup`: derive a provider-safe deterministic `reference` from the key; recover PaymentSession by provider/reference or sandbox WalletTransaction metadata.
- `CreateReservationPayment`: recover PaymentSession by stored key metadata, then reservation/user/provider and claim time window when the response was lost before metadata attachment.
- `CreateOrderPayment`: recover PaymentSession by stored key metadata, then user/restaurant/provider/canonical order set and claim time window.
- `PayOrdersByTableId` / `PayOrdersByOrderIds`: set a deterministic `externalRef`; recover PaymentTransaction and linked Invoice/Cashflow.
- `RefundToWallet`: recover the PaymentRefund and linked WalletTransaction using stored key metadata or the exact order/amount/reason/actor claim window.
- `AdjustWalletBalance`: recover the WalletTransaction using stored key metadata or exact customer/restaurant/amount/direction/reason/actor claim window.
- `PayOrdersWithWallet`: keep the existing specialized SHA-256/transaction boundary and unify browser key generation only.
- `CreateCheckoutOrders`: keep CheckoutRequestLock and the existing checkout fingerprint/result-recovery boundary.

## Files and reasons

- `models/payment-request-lock.model.js`: durable claim and completed-result state.
- `models/index.js`: model export.
- `src/services/payment/paymentRequestIdempotency.service.js`: key validation, canonical SHA-256 fingerprinting, claim/wait/recovery coordination, completion, and safe failure retry.
- `graphql/resolvers/payment/paymentIdempotencyMutation.js`: payment-session/POS/top-up preparation, recovery, and correlation metadata.
- `graphql/resolvers/payment/walletMoneyIdempotencyMutation.js`: wallet refund/adjustment recovery and metadata.
- `graphql/resolvers/payment/index.js`: apply both wrappers after all existing payment guards.
- `graphql/schema/paymentIdempotency.graphql`: require keys without rewriting the large domain schema files.
- `src/apollo/client.js`: common secure key lifecycle for every active money mutation while preserving other Apollo links.
- `QRPaymentModal.jsx`: use `CreateReservationPayment` GraphQL instead of the legacy REST creator.
- targeted backend/frontend contract tests.

## Validation plan

- Targeted Vitest for canonical fingerprint, key validation, operation coverage, schema contract, browser lifecycle, and stale-processing no-reclaim contract.
- Existing wallet parity, deferred checkout, payment readiness, merged-table, and refund lifecycle tests.
- GraphQL schema and operation validation.
- Targeted QR payment modal and order-management payment tests.
- Build and conflict-marker check when a runnable checkout is available.
