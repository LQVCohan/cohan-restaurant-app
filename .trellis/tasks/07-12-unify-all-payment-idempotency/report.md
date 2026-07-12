# Implementation report

## Trace completed

`PaymentRequestLock / PaymentSession / PaymentTransaction / PaymentRefund / WalletTransaction / Invoice / Cashflow / EventLog` -> shared payment claim and operation recovery wrappers -> final composed GraphQL payment mutation map -> Apollo key lifecycle -> reservation, order, POS, wallet and manager-wallet UI actions -> targeted contract tests.

## Implemented money commands

- `CreateCheckoutOrders`: existing CheckoutRequestLock and checkout fingerprint remain authoritative; Apollo lifecycle is unified.
- `CreateWalletTopup`: durable claim, deterministic provider reference, PaymentSession/sandbox transaction recovery.
- `CreateOrderPayment`: durable claim and PaymentSession recovery by key metadata or exact user/restaurant/provider/order context.
- `CreateReservationPayment`: durable claim and PaymentSession recovery; active UI moved from legacy REST creation to GraphQL.
- `PayOrdersByTableId` and `PayOrdersByOrderIds`: durable claim, deterministic `externalRef`, PaymentTransaction/Invoice/Cashflow replay.
- `PayOrdersWithWallet`: existing specialized wallet SHA-256 and settlement boundary retained; Apollo key lifecycle is unified.
- `RefundToWallet`: durable claim with PaymentRefund and WalletTransaction recovery.
- `AdjustWalletBalance`: durable claim with exact WalletTransaction recovery.

## Safety invariants

- The key is globally unique and bound to operation, authenticated actor, restaurant where available, and canonical SHA-256 request fingerprint.
- Exact completed retries return stored JSON-safe results.
- Reuse with another payload returns `IDEMPOTENCY_KEY_REUSED`.
- Concurrent or unresolved processing returns `PAYMENT_IN_PROGRESS`.
- An ambiguous `PROCESSING` claim is never automatically reclaimed; only a proven destination record can complete it.
- Failed commands may retry with the same key only after destination recovery confirms no committed result.
- Browser keys use `crypto.randomUUID()` or `crypto.getRandomValues()`, survive reload/network ambiguity, and clear only after the exact mutation returns success.
- Existing permissions, ownership, merged-table, served-item, discount, provider signature, callback, invoice, cashflow, audit and realtime logic remains inside the original resolver/service flow.

## Deliberate boundaries

- Refund approve/process/retry operations remain keyed by their existing `PaymentRefund` record and status machine; successful refund cashflow remains unique by `refundId`.
- Manual accounting, supplier payable and reconciliation commands retain their explicit entity/state guards and are not treated as customer payment-entry commands.
- The deprecated reservation-payment REST compatibility route remains present, but the active application modal no longer calls it.

## Validation

- Added targeted source/behavior contracts for SHA-256 canonicalization, key validation, durable claim schema, no-reclaim processing behavior, operation/schema/Apollo coverage, and GraphQL reservation creation.
- GitHub reports PR #1365 as mergeable and draft.
- Targeted Vitest, existing payment suites, GraphQL schema/operation validation, conflict-marker check and frontend build were not executed because this connector session has no runnable repository checkout and container DNS cannot resolve GitHub for cloning.
- Runtime/test pass is therefore not claimed.
