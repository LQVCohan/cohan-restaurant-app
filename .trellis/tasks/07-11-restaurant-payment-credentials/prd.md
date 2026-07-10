# Restaurant payment provider credentials

## Current behavior

- `Restaurant.paymentSettings` stores only provider label, active state, priority and sandbox/production mode.
- MoMo and VNPAY provider code reads one platform-wide credential set from backend environment variables.
- Managers cannot connect their own merchant account from the product UI.
- Provider callbacks also verify against the platform-wide secret, so adding only frontend fields would still fail.

## Required behavior

1. An authorized manager/admin can open a dedicated manager page for the selected restaurant.
2. The page supports MoMo and VNPAY Sandbox/Production credentials.
3. Secrets are encrypted before MongoDB persistence and never returned by GraphQL.
4. The UI only receives configured state and masked identifiers.
5. Reservation, order and POS payment creation uses the active credential for that restaurant and mode, otherwise falls back to platform environment credentials.
6. Each payment session records the credential document id used so callbacks continue verifying with the same secret after credentials are rotated.
7. Callback verification loads the credential referenced by the payment session before validating the signature.
8. Disconnecting a provider prevents future restaurant payments from using that credential but does not delete historical versions needed by pending callbacks.
9. Customer Cohan Balance topups remain platform-scoped because they are not associated with one restaurant.

## Security constraints

- Never store plaintext secret keys.
- Never return secret/access/hash values through GraphQL, logs or errors.
- Require `PAYMENT_CREDENTIAL_ENCRYPTION_KEY` in production; allow a clearly warned deterministic fallback only in development/test.
- Reuse `PAYMENT_READ` and `PAYMENT_WRITE` permission guards.
- Validate provider-specific required fields at the backend trust boundary.

## Acceptance criteria

- Manager sidebar contains “Cổng thanh toán”.
- Selected restaurant can save, replace and disconnect MoMo/VNPAY credentials.
- The page clearly separates Sandbox and Production and masks saved identifiers.
- Creating restaurant payments passes the resolved credential into the shared provider.
- MoMo/VNPAY callback verification uses the exact credential referenced by the payment session.
- Platform `.env` credentials remain a supported fallback.
- Focused tests cover encryption round-trip, masking, provider credential use and secret-free GraphQL status.

## Out of scope

- Storing customer wallet topup merchant credentials per restaurant.
- Automated merchant onboarding, OAuth or production KYC.
- A provider “connection test” that creates a real charge.
- Migrating existing platform environment secrets into MongoDB automatically.
