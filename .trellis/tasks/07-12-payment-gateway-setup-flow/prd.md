# Complete manager payment gateway setup flow

## Current behavior

- Managers can enter MoMo/VNPAY merchant credentials, choose sandbox or production, and toggle provider visibility.
- VNPAY onboarding is incomplete because the page does not expose the exact Return URL and IPN URL that the merchant must register with VNPAY.
- Runtime payment callers derive the public backend origin differently, so the URL shown to a manager could drift from the URL used to create a payment.
- Saving credentials and activating the provider are two frontend mutations. The credential can be persisted even when the second mutation fails, leaving the UI reporting failure after a partial success.

## Required behavior

1. The page shows a clear setup sequence for the selected restaurant.
2. It exposes copyable Return/IPN URLs derived from the same shared backend origin used by order, reservation and wallet payment creation.
3. It warns when the backend origin is localhost/private and cannot receive provider callbacks.
4. Saving a restaurant credential also selects its mode and enables that provider on the backend; the frontend performs one save mutation.
5. Existing permission checks, encryption, append-only credential versions, fallback credentials and callback verification remain intact.
6. Customer checkout only displays configured and enabled providers.

## Acceptance criteria

- Manager can copy VNPAY Return URL and IPN URL from the payment gateway page.
- The page describes the four steps: merchant registration, callback registration, credentials, enable/test.
- Credential save returns with provider mode/active configuration synchronized.
- Order, reservation and wallet payment creation use one callback-origin helper.
- Focused tests cover URL resolution, setup query output and the one-mutation frontend save flow.

## Out of scope

- Automated VNPAY KYC or merchant account creation.
- Calling VNPAY to validate credentials by creating a real charge.
- Storing wallet-topup credentials per restaurant.
