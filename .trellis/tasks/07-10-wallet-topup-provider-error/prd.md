# Wallet topup provider selection and MoMo error handling

## Current behavior

- `WalletPage` initializes `topupProvider` as `momo`, so pressing the topup button without touching the selector creates a MoMo payment.
- The UI only labels the choices `MoMo` and `VNPAY`, which does not make it clear that VNPAY is the bank-card path configured with `VNPAY_BANK_CODE=VNBANK`.
- When MoMo rejects a signature, `createMomoPayment` forwards the complete upstream message into GraphQL. The provider message can contain the raw signing string, callback URLs, request identifiers, and encoded metadata, producing the long internal error shown to the customer.
- The MoMo request signature field order already matches the official `captureWallet` contract, so changing the signing formula would be the wrong fix.

## Root cause

The immediate request is being routed to the wrong provider because the frontend silently defaults to MoMo. Separately, the shared provider boundary forwards untrusted upstream diagnostic text directly to the UI. A mismatched Sandbox credential set or surrounding whitespace can still cause MoMo signature rejection, but secret values cannot be corrected in repository code.

## Flow traced

`WalletTopupInput` -> wallet resolver -> `createWalletTopup` -> `createMomoPayment` or `createVnpayPayment` -> GraphQL result/error -> `WalletPage` provider selector and topup action.

## Scope

- Require an explicit payment-provider choice on the wallet page.
- Label MoMo as a wallet payment and VNPAY as the bank-card payment path.
- Disable the topup action until a supported provider is selected.
- Trim MoMo credential values before signing.
- Replace raw MoMo signature errors with a safe, actionable customer-facing message.
- Add a targeted regression test proving the raw signing string is not exposed.

## Acceptance criteria

1. Opening `/wallet` does not silently select MoMo.
2. Selecting `VNPAY (thẻ ngân hàng)` sends provider `vnpay` unchanged through the existing GraphQL mutation.
3. Selecting `MoMo (ví điện tử)` still sends provider `momo`.
4. A MoMo invalid-signature response does not expose `accessKey=`, `ipnUrl=`, `redirectUrl=`, or the raw signing string to the frontend.
5. Existing callback signature and VNPAY tests continue to pass.
6. No credentials or local `.env` values are committed.

## Out of scope

- Replacing or guessing the user's local MoMo credential values.
- Changing the GraphQL schema default, because the current frontend sends provider explicitly.
- Changing VNPAY settlement, IPN, or card-channel behavior.
- Adding a new payment abstraction or dependency.

## Validation

- Targeted `payment-provider-errors.security.test.js`.
- Frontend lint/build through GitHub CI.
- Backend lint/test/build through GitHub CI.
