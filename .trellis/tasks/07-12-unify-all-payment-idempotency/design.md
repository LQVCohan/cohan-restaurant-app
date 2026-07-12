# Design

## End-to-end flow

1. Apollo recognizes a payment mutation and generates one secure top-level `idempotencyKey` with Web Crypto.
2. The key is stored by operation plus canonical input fingerprint until the corresponding mutation returns success.
3. GraphQL validates that payment inputs contain the key.
4. The final composed payment resolver map is wrapped after ownership, permission, merged-table, and strict-payment wrappers are assembled.
5. The wrapper calls `runIdempotentPaymentRequest`, which hashes operation, authenticated user, optional restaurant, and canonical input with SHA-256.
6. `PaymentRequestLock` atomically claims the key. Existing claims must match operation, owner, restaurant, and fingerprint.
7. The original resolver executes once. Existing services continue to own pricing, provider creation, transaction settlement, invoice, cashflow, permissions, audit, and realtime behavior.
8. The wrapper stores a JSON-safe completed result and correlation metadata. Exact retries return that result without calling the original resolver.
9. For an ambiguous failure, destination recovery checks the deterministic top-up reference, payment-session business scope, or POS external reference before allowing a retry.

## Claim lifecycle

- `PROCESSING`: one owner is executing.
- `COMPLETED`: return stored result.
- `FAILED`: the same request may reclaim after destination recovery confirms that nothing committed.
- A processing claim waits briefly; a stale claim attempts destination recovery before reclaim.
- Completed claims live longer than failed claims; Mongo TTL removes expired claims.

## Operation recovery

- `CreateWalletTopup`: derive a provider-safe deterministic `reference` from the key; recover PaymentSession by provider/reference or sandbox WalletTransaction metadata.
- `CreateReservationPayment`: recover a matching PaymentSession created for the same reservation, user, provider, and claim time window.
- `CreateOrderPayment`: recover a matching PaymentSession for the same user, restaurant, provider, and canonical order set.
- `PayOrdersByTableId` / `PayOrdersByOrderIds`: set a deterministic `externalRef`; recover PaymentTransaction and the linked Invoice/Cashflow.
- `PayOrdersWithWallet`: keep the existing specialized SHA-256/transaction boundary and only unify browser key generation.

## Files and reasons

- `models/payment-request-lock.model.js`: durable claim and result state.
- `models/index.js`: model export.
- `src/services/payment/paymentRequestIdempotency.service.js`: key validation, fingerprinting, claiming, waiting, recovery coordination, completion/failure.
- `graphql/resolvers/payment/paymentIdempotencyMutation.js`: operation-specific input preparation and result recovery around the final mutation map.
- `graphql/resolvers/payment/index.js`: apply wrapper after all existing payment guards.
- payment and wallet schemas: require keys.
- `src/apollo/client.js`: common secure key lifecycle for all payment mutation names.
- `QRPaymentModal.jsx`: use `CreateReservationPayment` GraphQL instead of the legacy REST creator.
- targeted backend/frontend contract tests.

## Validation plan

- Targeted Vitest for claim fingerprint, key reuse, completed replay, and concurrent/stale behavior.
- Existing wallet parity and deferred checkout tests.
- GraphQL schema and operation validation.
- Targeted QR payment modal and order-management payment tests.
- Build and conflict-marker check when a runnable checkout is available.
