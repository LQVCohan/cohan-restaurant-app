# VNPAY card-channel testing

## Current behavior

- VNPAY creates a signed payment URL without `vnp_BankCode`.
- The current sandbox merchant configuration can therefore open directly on QR, so the supplied domestic test-card data cannot be entered.
- Reservation, POS order, and wallet flows already share `createVnpayPayment`.

## Root cause

The shared VNPAY URL builder has no optional payment-channel configuration. Adding separate schema fields or caller-specific branches would duplicate a provider integration concern across multiple flows.

## Flow traced

Restaurant payment settings/model -> GraphQL or REST payment creation -> `createReservationPayment`, `createOrderPayment`, or wallet service -> `createVnpayPayment` -> signed VNPAY URL -> ReturnURL/IPN validation tests.

## Scope

- Read optional backend-only `VNPAY_BANK_CODE` in `createVnpayPayment`.
- Normalize it and include `vnp_BankCode` before signing when configured.
- Keep the parameter absent when the variable is blank or missing.
- Document common values: blank for the provider selector, `VNBANK` for domestic bank/card flow, `VNPAYQR` for QR, and `INTCARD` for international cards.
- Add regression coverage proving both configured and unconfigured behavior.

## Acceptance criteria

1. Existing VNPAY behavior remains unchanged when `VNPAY_BANK_CODE` is blank or missing.
2. `VNPAY_BANK_CODE=VNBANK` produces a signed URL containing `vnp_BankCode=VNBANK`.
3. `vnp_BankCode` participates in HMAC-SHA512 signing.
4. No secret values are committed.

## Out of scope

- Enabling VNBANK/INTCARD on the VNPAY merchant account.
- Changing callback/IPN settlement logic.
- Adding a per-restaurant channel selector.
- Renaming the separate manual `card` method in POS.
- Removing the existing reservation REST endpoint.

## Validation

- `git diff --check`
- targeted provider security test
- backend syntax check for `providers.js`
