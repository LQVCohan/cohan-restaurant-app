# Wallet idempotency hardening

## Current behavior

- Customer checkout sends a modal-generated value, then the Apollo idempotency link replaces it with a key stored by payload fingerprint.
- The Apollo generator falls back to `Date.now()` and `Math.random()` when `randomUUID()` is unavailable.
- Checkout requests are protected server-side by `CheckoutRequestLock`, account binding, a SHA-256 request fingerprint, unique indexes, and completed-result recovery.
- Cohan wallet payment uses the checkout key plus `:wallet`, but direct `payOrdersWithWallet` calls can omit the key and an existing transaction is returned without proving that the retried order set matches the original request.

## Root cause

Checkout and wallet settlement do not use one explicit idempotency contract. The browser has no completion-aware key lifecycle: retaining a payload key forever blocks a legitimate repeat order, while replacing it merely because the page reloaded can duplicate an ambiguously completed checkout. The wallet entrypoint also treats the key as sufficient without binding it to a canonical wallet-payment fingerprint.

## Scope

- Keep Apollo as the only producer of the actual customer-checkout idempotency key.
- Use Web Crypto only for generated keys; do not fall back to `Math.random()`.
- Keep the payload-scoped key in session storage while the result is ambiguous, including reloads and network retries.
- Clear that key only after Apollo receives a successful `createCheckoutOrders` result, allowing a later identical order to receive a new key.
- Require a direct wallet idempotency key.
- Route every current wallet-payment caller through one shared idempotency boundary.
- Bind each wallet key to user, restaurant, and sorted order IDs with SHA-256.
- Persist the same correlation ID and fingerprint on payment, ledger, wallet transaction, and audit metadata.
- Reject key reuse with a different wallet payload.

## Acceptance criteria

1. Retrying or reloading an ambiguous checkout sends the same actual key for the same payload.
2. After a successful checkout response, an identical later checkout receives a new key.
3. Generated keys use `crypto.randomUUID()` or `crypto.getRandomValues()` only.
4. `payOrdersWithWallet` rejects a missing or malformed key.
5. A repeated key returns the existing result only when the canonical wallet fingerprint matches.
6. A repeated key with another account, restaurant, or order set returns `IDEMPOTENCY_KEY_REUSED` and never debits the wallet twice.
7. PaymentSession, PaymentTransaction, WalletTransaction, and EventLog carry the correlation ID and request fingerprint.

## Out of scope

- A new CheckoutIntent collection or API.
- Changes to MoMo/VNPAY signatures and callbacks.
- Changing checkout pricing, order creation, wallet balance rules, refund behavior, or manager UI.
