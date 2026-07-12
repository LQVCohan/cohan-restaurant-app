# VNPAY flow audit report

## Result

The shared VNPAY provider implementation, signature verification, amount validation, signed ReturnURL fallback and final settlement handlers were already present and logically connected to order, reservation and wallet flows.

Two integration defects were fixed:

1. **Public return origin drift** — order/reservation used legacy environment names and localhost while wallet used a separate request-derived implementation. All active GraphQL provider-payment flows now use one helper supporting `API_PUBLIC_BASE_URL`, `PUBLIC_BASE_URL`, `APP_PUBLIC_URL`, forwarded origin and a consistent local fallback.
2. **Wallet platform mode drift** — external PaymentSessions without `restaurantId` skipped credential binding, so wallet top-up selected the gateway endpoint from `NODE_ENV`. The PaymentSession hook now resolves platform credentials/mode for wallet sessions and preserves the existing production-in-development guard.

## Flow status after the fix

- Customer checkout -> create order -> create VNPAY PaymentSession -> open VNPAY URL -> signed return/IPN -> settle orders: connected.
- Reservation/deposit -> create VNPAY PaymentSession -> poll reservation -> signed return/IPN -> mark deposit paid: connected.
- Wallet top-up -> create platform VNPAY PaymentSession -> poll payment -> signed return/IPN -> idempotent wallet credit: connected.
- POS/manual payment continues to use its existing payment mutation path; no provider-signature behavior was changed.

## Pull request

Draft PR: #1369 (`agent/vnpay-flow-audit-fix` -> `main`).

## Validation

Added targeted tests for request origin/client IP, checkout propagation, reservation propagation and wallet platform-mode binding. Tests and builds were not executed because the available container could not resolve `github.com` to clone the repository. Runtime success against the VNPAY sandbox merchant is therefore not claimed.
