# Design

## End-to-end flow

1. `OrderSummaryCheckoutModal` supplies a value that identifies the current modal checkout attempt.
2. Apollo `idempotencyLink` maps that attempt to one cryptographically generated `CreateCheckoutOrders` key and mirrors it into top-level input and `clientMeta`.
3. `withCheckoutIdempotency` validates the key, hashes the canonical checkout input, and claims `CheckoutRequestLock` for the authenticated user.
4. Deferred wallet checkout creates orders without releasing them, then calls `payOrdersWithWallet` with `<checkout-key>:wallet`.
5. The wallet service canonicalizes user, restaurant and sorted order IDs, computes SHA-256, checks existing successful settlement, and only then debits and settles in one Mongo transaction.
6. Shared settlement creates the invoice/payment ledger; wallet-specific metadata adds the common correlation ID and request fingerprint.

## Smallest implementation

- Change only the shared Apollo link and wallet service boundaries.
- Reuse the modal's existing per-open attempt value; do not edit the large checkout component.
- Reuse existing `node:crypto`, Mongo transaction, PaymentSession unique reference, PaymentTransaction unique wallet index, and CheckoutRequestLock.
- Make GraphQL require the direct wallet key so all public callers follow the contract.
- Extend the existing parity source-contract test rather than adding a new test harness.

## Validation plan

- Run the targeted wallet parity Vitest file.
- Run GraphQL schema validation.
- Run the frontend build or the narrowest Apollo/client test available.
- Inspect the final diff and GitHub commit status. If the connector session cannot execute repository commands, record that limitation explicitly.
