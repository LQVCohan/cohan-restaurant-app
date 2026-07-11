# Implementation report

## Trace completed

`CheckoutSession / CheckoutRequestLock / PaymentSession / PaymentTransaction / WalletTransaction / EventLog` -> checkout idempotency wrapper and wallet settlement service -> GraphQL checkout and wallet mutations -> Apollo idempotency link -> customer checkout action -> targeted wallet/deferred tests.

## Changes

- `src/apollo/client.js`
  - Removed the `Date.now()` / `Math.random()` fallback for actual request keys.
  - Generates keys with `crypto.randomUUID()` or `crypto.getRandomValues()` only.
  - Keeps one payload-scoped checkout key in session storage while the outcome is ambiguous, including reload/network retry.
  - Removes that key only after Apollo receives a successful `createCheckoutOrders` result, so an identical later order receives a new key.
- `cohan-restaurant-backend/src/services/wallet/idempotentWalletPayment.service.js`
  - Added the single shared public boundary for Cohan-wallet order payments.
  - Validates key format and object IDs.
  - Computes SHA-256 over operation version, user, restaurant, and sorted unique order IDs.
  - Verifies existing PaymentSession/PaymentTransaction ownership and payload before delegating to the existing transactional wallet settlement.
  - Reads the authoritative transaction again after settlement to close concurrent same-key/different-payload races.
  - Returns `IDEMPOTENCY_KEY_REUSED` for cross-account, cross-restaurant, or different-order reuse.
  - Adds correlation ID and request fingerprint metadata to PaymentSession, PaymentTransaction, WalletTransaction, and EventLog without turning a committed debit into a client-visible failure if an observability-only metadata update fails.
- Both wallet callers now import the shared boundary:
  - `graphql/resolvers/wallet/index.js`
  - `graphql/resolvers/order/deferredOnlineCheckout.js`
- `graphql/schema/wallet.graphql` now requires `idempotencyKey: String!` for direct wallet payment.
- Tests:
  - Added deterministic/reordered/different-order fingerprint assertions and source-contract checks.
  - Updated deferred checkout mocking to the new boundary path.
  - Added checks for secure browser generation and the retain-until-success key lifecycle.

## Deliberate simplification

No `CheckoutIntent` collection was added. Existing `CheckoutRequestLock`, PaymentSession unique provider/reference, PaymentTransaction wallet unique index, and the Apollo success-aware storage lifecycle cover the required invariants without another state machine.

## Validation

- Repository files and all known callers were re-fetched from the latest `main` before writes.
- GitHub reports no workflow runs and no combined status checks for code commit `c1728ac83abad715f0bcc8166033b94265920356`.
- Targeted Vitest, GraphQL validation, and frontend build were not executed because this connector session has no runnable repository checkout and container DNS cannot resolve GitHub for cloning.
- Therefore runtime/test pass is not claimed.
