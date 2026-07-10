# VNPAY card-channel clarity

## Current behavior

- The POS shows `Thẻ`, but that action records a card payment completed at the physical counter; it does not open VNPAY.
- VNPAY creates a signed payment URL without `vnp_BankCode`, leaving the provider/merchant configuration to choose the first payment experience. On the current sandbox account this can lead directly to QR, so the supplied card test data cannot be entered.
- Reservation, POS order, and wallet flows already share `createVnpayPayment`, so the provider boundary is the narrowest common fix.

## Root cause

The distinction between at-counter card payment and VNPAY online card payment is not explicit in the UI, while the shared VNPAY URL builder has no optional payment-channel configuration.

## Flow traced

Restaurant payment settings/model -> GraphQL/REST payment creation -> `createReservationPayment` / `createOrderPayment` / wallet service -> `createVnpayPayment` -> signed VNPAY URL -> POS or customer payment UI -> callback/IPN tests.

## Scope

- Rename the POS `Thẻ` label to `Thẻ tại quầy` without changing the stored `card` method.
- Read optional backend-only `VNPAY_BANK_CODE` in `createVnpayPayment`.
- When present, include it as `vnp_BankCode` before signing.
- Document common values: blank for provider selector, `VNBANK` for domestic bank/card flow, `VNPAYQR` for QR, and `INTCARD` for international cards.
- Add a provider regression test proving that the bank code is part of the signed URL.

## Acceptance criteria

1. Existing VNPAY behavior remains unchanged when `VNPAY_BANK_CODE` is blank or missing.
2. `VNPAY_BANK_CODE=VNBANK` produces a signed URL containing `vnp_BankCode=VNBANK`.
3. The signature test still passes after adding the optional parameter.
4. POS users see `Thẻ tại quầy`, while the underlying payment method remains `card`.
5. No secret values are committed.

## Out of scope

- Enabling VNBANK/INTCARD on the VNPAY merchant account.
- Changing callback/IPN settlement logic.
- Adding a per-restaurant merchant credential or channel selector.
- Removing the existing reservation REST endpoint.

## Validation

- `git diff --check`
- targeted provider security test
- targeted PaymentModal component/source assertion if an existing test is available
- frontend production build when available
