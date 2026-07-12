# Design

## Flow

`Restaurant.paymentSettings + PaymentProviderCredential -> payment credential resolver/service -> GraphQL setup query/save mutation -> Apollo page query/mutation -> manager setup steps -> customer payment selector -> PaymentSession -> provider callback`

## Shared request context

Add one payment request-context helper that resolves the public API origin in this order:

1. `API_PUBLIC_BASE_URL`
2. `PUBLIC_BASE_URL`
3. `APP_PUBLIC_URL`
4. trusted forwarded protocol/host from the request
5. local fallback

The helper also normalizes the client IP and identifies whether the resolved origin is publicly reachable. Setup instructions and payment creation must use the same helper.

## Setup query

Expose secret-free setup information for an authorized restaurant manager:

- public backend origin
- whether it is publicly reachable
- MoMo/VNPAY Return URL
- MoMo/VNPAY IPN URL

## Save semantics

`saveRestaurantPaymentCredential` remains the credential trust boundary. After saving the encrypted credential version, it synchronizes the selected provider in `Restaurant.paymentSettings` to the saved mode and active state. The frontend no longer chains a separate settings mutation after credential save.

## UI

Add a compact four-step setup section above provider cards. Show exact callback URLs with native clipboard copy buttons and a blocking warning when the origin is local. Keep the existing provider forms, masked identifiers, mode switch and enable/disable toggle.
