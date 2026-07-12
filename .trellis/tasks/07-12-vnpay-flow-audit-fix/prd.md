# Audit and harden VNPAY payment flows

## Problem

VNPAY signing, amount verification, ReturnURL fallback and IPN settlement already exist, but payment creation does not use one authoritative request context across order, reservation and wallet flows.

Two root causes were found:

1. Order and reservation GraphQL resolvers only read `PUBLIC_BASE_URL` / `APP_PUBLIC_URL` and otherwise fall back to localhost. Wallet top-up separately reads `API_PUBLIC_BASE_URL` and request headers. A deployment using the documented backend origin convention can therefore generate an unreachable VNPAY ReturnURL for checkout or reservation payments.
2. Wallet top-up has no `restaurantId`, so the PaymentSession pre-save credential hook does not bind `providerCredentialMode`. The wallet service then chooses VNPAY mode from `NODE_ENV`, which can combine platform sandbox credentials with the production endpoint.

## Real flow traced

`GraphQL schema -> payment mutation wrapper/idempotency -> order/reservation/wallet resolver -> PaymentSession service or wallet service -> createVnpayPayment -> signed VNPAY URL -> GET IPN / signed ReturnURL fallback -> applyPaymentProviderCallback -> reservation confirmation, order settlement or wallet credit -> frontend polling/UI`.

## Requirements

1. Resolve public API origin and client IP through one backend helper for every active GraphQL provider-payment flow.
2. Preserve backward compatibility for `API_PUBLIC_BASE_URL`, `PUBLIC_BASE_URL` and `APP_PUBLIC_URL`.
3. Use proxy/request origin only as a fallback and normalize trailing slashes.
4. Bind wallet provider sessions to the actual `MOMO_PLATFORM_MODE` / `VNPAY_PLATFORM_MODE` before provider URL generation.
5. Keep the existing development guard that blocks production gateways unless explicitly allowed.
6. Do not alter VNPAY HMAC-SHA512 signing, amount checks, callback settlement, idempotency or permissions.
7. Document the public backend origin required for provider callbacks/returns.

## Acceptance criteria

- Checkout, reservation deposit and wallet top-up create ReturnURLs with the same public backend origin.
- `VNPAY_PLATFORM_MODE=sandbox` always produces a sandbox VNPAY URL for wallet top-up, including under a production Node runtime.
- A production platform credential cannot be used from development unless the existing explicit opt-in is enabled.
- Existing order ownership and staff permission checks remain unchanged.
- Targeted tests cover origin resolution, proxy/client IP parsing and customer order propagation.
