# Unified payment idempotency

## Current behavior

- Customer checkout and Cohan-wallet order payment already use specialized idempotency keys and backend payload binding.
- `createWalletTopup`, `createOrderPayment`, `createReservationPayment`, `payOrdersByTableId`, and `payOrdersByOrderIds` do not share one required key contract.
- `refundToWallet` and `adjustWalletBalance` can move wallet balances directly but rely on UI loading state and destination checks rather than a request claim.
- Provider callbacks are settlement-idempotent, but retrying the mutation that creates a payment session can still create another session.
- The reservation deposit modal calls a legacy REST creation endpoint, bypassing the GraphQL payment boundary.
- POS payment mutations accept an optional `externalRef`, but the application does not generate or retain one consistently.

## Root cause

Idempotency is implemented per settlement path rather than at the shared money-command boundary. The browser only manages a stable retry key for checkout, while other payment mutations rely on button disabling, pending-session heuristics, or destination-record state.

## Scope

- Require `idempotencyKey` for all active application money commands that can create a payment/session or change wallet balance:
  - create reservation deposit payment;
  - create order provider/bank-transfer payment;
  - create wallet top-up;
  - pay selected orders or a table at POS;
  - pay orders with Cohan wallet (existing specialized boundary retained);
  - refund an order to Cohan wallet;
  - manually adjust a customer wallet balance.
- Add one payment request claim model keyed globally by idempotency key.
- Bind each claim to operation, authenticated actor, restaurant when available, and a SHA-256 canonical request fingerprint.
- Retain completed response data for exact retries and recover destination records after ambiguous failures.
- Never rerun an ambiguous `PROCESSING` money command unless a destination record proves the prior command failed; otherwise return `PAYMENT_IN_PROGRESS`.
- Generate secure browser keys with Web Crypto, retain them while the result is ambiguous, and clear only after the matching mutation succeeds.
- Move reservation deposit creation to the GraphQL mutation so it uses the same authenticated payment boundary.

## Acceptance criteria

1. The same key and same canonical request never creates a second payment session, payment transaction, invoice, cashflow, refund, adjustment, or wallet credit/debit.
2. Reusing a key with another operation, actor, restaurant, provider, amount, reservation, table, order set, customer, reason, or direction returns `IDEMPOTENCY_KEY_REUSED`.
3. Concurrent submissions either return one completed result or `PAYMENT_IN_PROGRESS`; they never execute two money movements.
4. A failed or lost client response keeps the same browser key for retry/reload.
5. A successful response clears the browser key so a later legitimate command receives a new key.
6. Provider callback verification and existing settlement-level idempotency remain unchanged.
7. Existing permission, ownership, table-merge, served-item, discount, invoice, cashflow, audit, realtime, and provider-signature behavior remains in the final resolver flow.
8. Refund approval/processing remains keyed by its existing `PaymentRefund` record and successful refund cashflow remains unique by `refundId`.

## Out of scope

- Manual accounting entries, supplier payable administration, reconciliation decisions, and refund approval state transitions. These operate on explicitly selected finance records and retain their existing entity/state guards.
- Changes to MoMo/VNPAY signing formats or callback contracts.
- Replacing CheckoutRequestLock or the specialized Cohan-wallet settlement boundary.
- Removing the deprecated reservation-payment REST compatibility route; the active application caller is migrated to GraphQL.
