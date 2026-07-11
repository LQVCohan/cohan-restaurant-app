# Design

## End-to-end flow

1. `OrderSummaryCheckoutModal` submits checkout input; its local value is ignored as a financial key because Apollo replaces it.
2. Apollo `idempotencyLink` hashes the canonical payload, reuses one cryptographically generated `CreateCheckoutOrders` key from session storage while the result is ambiguous, and mirrors it into top-level input and `clientMeta`.
3. If the network fails or the page reloads before a success response, the same payload resolves to the same key. Apollo removes the stored key only after receiving `data.createCheckoutOrders`, so a later identical order can start a new operation.
4. `withCheckoutIdempotency` validates the key, hashes the canonical checkout input with SHA-256, and claims `CheckoutRequestLock` for the authenticated user.
5. Deferred wallet checkout creates orders without releasing them, then calls the shared wallet idempotency boundary with `<checkout-key>:wallet`.
6. The boundary validates the public key contract, canonicalizes user, restaurant and sorted order IDs, computes SHA-256, verifies any existing PaymentSession/PaymentTransaction, then delegates the debit and settlement to the existing transactional wallet service.
7. After settlement it reads the authoritative PaymentTransaction again. A same-key race with another account, restaurant, or order set is rejected as `IDEMPOTENCY_KEY_REUSED`; a matching retry returns the existing result.
8. Shared settlement remains responsible for invoice/payment/cashflow/order release. The boundary adds the common correlation ID and request fingerprint to PaymentSession, PaymentTransaction, WalletTransaction, and EventLog metadata.

## Smallest implementation

- Keep the existing checkout lock and transactional wallet settlement; do not add `CheckoutIntent` or duplicate ledger logic.
- Add one shared wallet-payment boundary because both the GraphQL mutation and deferred checkout require the same validation.
- Route all current callers through that boundary and require the key in GraphQL.
- Use `node:crypto`, Web Crypto, existing Mongo indexes, and existing metadata fields; add no dependency or schema collection.
- Extend the existing wallet parity test and update the deferred checkout mock path.

## Validation plan

- Run the targeted wallet parity and deferred checkout Vitest files.
- Run GraphQL schema validation.
- Run the frontend build or the narrowest Apollo/client check available.
- Inspect the final diff and GitHub commit status. If the connector session cannot execute repository commands, record that limitation explicitly.
