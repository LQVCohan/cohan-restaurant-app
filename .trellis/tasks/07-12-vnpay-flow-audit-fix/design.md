# Design

## Shared request context

Add `paymentRequestContext.js` under the existing payment service boundary with two pure helpers:

- `getPaymentBaseApiUrl(ctx, env)`: prefer configured public backend origin, otherwise derive the first forwarded host/protocol or request host, then fall back to local port 4000.
- `getPaymentClientIp(ctx)`: normalize the first forwarded IP and remove IPv4-mapped IPv6 prefixes.

The helper is used by customer order payment, reservation payment and wallet top-up resolvers. This removes three incompatible URL/IP implementations.

## Reservation resolver composition

The large legacy payment mutation module already gets composed from focused resolver modules, and customer order payment is already overridden by a focused ownership-aware resolver. Add a focused reservation provider-payment resolver and compose it after the legacy map so the active mutation uses the shared request context without modifying unrelated finance/POS code.

## Wallet provider mode

Before creating an external wallet PaymentSession:

1. read the platform credential mode from the existing credential service;
2. apply the existing runtime production guard;
3. reject production credentials in development unless explicitly allowed;
4. persist `providerCredentialSource=platform` and `providerCredentialMode` on the PaymentSession;
5. pass that stored mode to the provider URL builder.

This keeps callback credential resolution consistent because the callback can recover the stored mode from the session.

## Validation

- Unit-test configured/fallback origins and client IP normalization.
- Extend the customer order mutation test to assert the public origin and client IP forwarded to the service.
- Add a source-level regression assertion for wallet platform-mode binding only if a fully isolated wallet service test would require mocking unrelated accounting models.
- Run targeted Vitest and syntax checks when a runnable checkout is available.
