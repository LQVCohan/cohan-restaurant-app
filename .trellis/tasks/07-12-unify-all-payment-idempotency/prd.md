# Unified payment idempotency

## Current behavior

- Customer checkout and Cohan-wallet order payment already use idempotency keys and backend payload binding.
- `createWalletTopup`, `createOrderPayment`, `createReservationPayment`, `payOrdersByTableId`, and `payOrdersByOrderIds` do not share one required key contract.
- Provider callbacks are settlement-idempotent, but retrying the mutation that creates a payment session can still create another session.
- The reservation deposit modal calls a legacy REST creation endpoint, bypassing the GraphQL payment boundary.
- POS payment mutations accept an optional `externalRef`, but the application does not generate or retain one consistently.

## Root cause

Idempotency is implemented per settlement path rather than at the shared payment-command boundary. The browser only manages a stable retry key for checkout, while other payment mutations rely on button disabling, pending-session heuristics, or destination-record state.

## Scope

- Require `idempotencyKey` for all active customer/POS payment commands:
  - create reservation deposit payment;
  - create order provider/bank-transfer payment;
  - create wallet top-up;
  - pay selected orders or a table at POS;
  - pay orders with Cohan wallet (existing boundary retained).
- Add one payment request claim model keyed globally by idempotency key.
- Bind each claim to operation, authenticated user, restaurant when available, and a SHA-256 canonical request fingerprint.
- Retain completed response data for exact retries and recover destination records after ambiguous failures.
- Generate secure browser keys with Web Crypto, retain them while the result is ambiguous, and clear only after the matching mutation succeeds.
- Move reservation deposit creation to the GraphQL mutation so it uses the same authenticated payment boundary.

## Acceptance criteria

1. The same key and same canonical request never creates a second payment session, payment transaction, invoice, cashflow, or wallet credit.
2. Reusing a key with another operation, account, restaurant, provider, amount, reservation, table, or order set returns `IDEMPOTENCY_KEY_REUSED`.
3. Concurrent submissions either return one completed result or `PAYMENT_IN_PROGRESS`; they never execute two money movements.
4. A failed or lost client response keeps the same browser key for retry/reload.
5. A successful response clears the browser key so a later legitimate command receives a new key.
6. Provider callback verification and existing settlement-level idempotency remain unchanged.
7. Existing permission, ownership, table-merge, discount, invoice, cashflow, audit, realtime, and provider-signature behavior remains in the final resolver flow.

## Out of scope

- Manual accounting entries, supplier payable administration, reconciliation decisions, and refund approval workflow. These are finance commands keyed by existing entity IDs rather than customer payment-entry commands.
- Changes to MoMo/VNPAY signing formats or callback contracts.
- Replacing CheckoutRequestLock or the specialized Cohan-wallet settlement boundary.
