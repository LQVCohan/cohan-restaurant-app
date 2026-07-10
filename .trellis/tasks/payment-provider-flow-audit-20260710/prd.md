# Payment provider flow audit

## Current behavior and root cause

- MoMo create/IPN payloads broadly match the official contract and already use a server-to-server IPN URL.
- VNPAY payment URLs are signed with SHA-256, use UTC timestamps, and omit the required `vnp_ExpireDate`; the current VNPAY Node sample uses HMAC-SHA512 and requires GMT+7 timestamps.
- The backend only exposes a POST provider webhook, while VNPAY calls its IPN URL with GET and expects `{ RspCode, Message }`.
- VNPAY success currently checks only `vnp_ResponseCode`; it must also require `vnp_TransactionStatus === "00"`.
- The browser return route mutates payment state and returns raw JSON. VNPAY documents ReturnURL as a checksum/display path while IPN is the authoritative state-update path.
- The restaurant information UI exposes sandbox/production terminology that managers do not need.

## End-to-end flow

Restaurant schema/payment settings -> payment resolver/service -> provider URL/signature -> provider IPN/return routes -> payment session settlement/realtime -> Apollo payment polling -> POS/customer payment UI -> restaurant payment settings UI.

## Scope

- Align VNPAY URL creation, callback verification, status mapping, IPN method and response with the official contract.
- Keep callback handling idempotent and preserve order/reservation settlement and realtime behavior.
- Keep MoMo's existing create/IPN behavior intact.
- Remove environment wording/control from the restaurant manager payment-settings tab while preserving the stored provider mode internally.

## Constraints

- No new dependency.
- Do not expose secrets or raw provider payloads.
- Do not alter cash, card, bank-transfer, promotion, invoice, permission or restaurant scoping behavior.
- Use the smallest shared-boundary changes and existing tests/patterns.

## Acceptance criteria

1. VNPAY URL uses GMT+7 `vnp_CreateDate`, includes `vnp_ExpireDate`, and uses HMAC-SHA512 for create and callback verification.
2. VNPAY is successful only when both response and transaction statuses are `00`.
3. A GET VNPAY IPN route processes the callback and returns VNPAY-compatible `RspCode`/`Message` JSON.
4. VNPAY ReturnURL verifies/displays the result without being the authoritative settlement path and does not show raw backend JSON to the payer.
5. MoMo POST webhook remains functional.
6. Restaurant managers see MoMo and VNPAY controls without sandbox/production wording.
7. Targeted provider and component tests cover the changed behavior.

## Out of scope

- Production credential onboarding or secret rotation.
- Refund/querydr APIs.
- New payment providers.
- Redesigning the full POS payment modal.
