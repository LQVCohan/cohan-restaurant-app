# Implementation

## Completed changes

- Added `paymentRequestContext.js` as the single source for provider public origin and client IP.
- Customer checkout VNPAY creation now passes the normalized public origin and proxy-aware client IP.
- Added a focused reservation provider resolver and composed it after the legacy mutation map.
- Wallet top-up resolver now uses the same request-context helper.
- PaymentSession pre-save credential binding now applies to external provider sessions even when `restaurantId` is absent, selecting platform mode for wallet top-ups.
- Added `API_PUBLIC_BASE_URL` to `.env.example`.
- Added regression tests for request context, checkout propagation, reservation propagation and wallet platform-mode binding.

## Unchanged boundaries

- VNPAY HMAC-SHA512 parameters and sorting.
- VNPAY amount, response-code and transaction-status validation.
- Signed ReturnURL fallback and IPN settlement behavior.
- Wallet credit, reservation deposit and order settlement idempotency.
- Customer ownership and restaurant payment permissions.

## Validation limitation

The repository could not be cloned in the execution container because DNS resolution for `github.com` failed. Targeted Vitest, `node --check`, GraphQL schema validation and builds were therefore not executed in this session.
