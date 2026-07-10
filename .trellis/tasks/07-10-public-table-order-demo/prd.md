# Public table QR ordering demo

## Current behavior and root cause

- A signed table QR opens `/table/:restaurantId/:tableId?token=...` without authentication.
- The public page can only view active orders, call staff, and request payment.
- `createOrderForTable` is staff-protected and creates kitchen work items immediately, so it cannot be exposed directly to a public QR flow that requires staff/POS review first.
- The authenticated online cart owns inventory holds by `userId`, while a table QR visitor may remain anonymous.
- Existing customer identity helpers already support registered customers and 30-day guest customers, but a public flow must never accept an arbitrary `userId` from the browser.
- Existing proof upload is correctly restricted to by-weight items, but the public table response does not expose proof images.

## End-to-end flow

`printed signed QR -> public table access validation -> optional phone prompt -> sandbox OTP -> optional registered-account confirmation or guest identity -> public menu -> local table cart -> atomic inventory reservation + pending order batch -> staff/POS queue -> atomic accept/reject -> accepted order creates kitchen work items and print jobs -> kitchen lifecycle -> public table polling/realtime proof updates`.

## Scope

1. Keep table viewing public and allow the customer to skip or close the phone prompt.
2. Explain that linking a phone stores order history, enables points after successful payment, and supports later management.
3. Use a thesis/demo OTP fixed to `123456` by default outside production. Production must reject the sandbox OTP path.
4. After valid OTP:
   - a matching registered customer requires an explicit confirmation before linking;
   - no registered customer creates or reuses the existing temporary guest type;
   - declining or closing confirmation keeps the table order anonymous.
5. Never expose or trust a browser-supplied customer id. Use signed, table-scoped identity tokens.
6. Allow ordering only for an active service table (`reserved`, `occupied`, or `payment_pending` only when not already requesting payment) and block new batches once the table session is ready to pay/paid/closed.
7. Create QR orders as pending order batches with inventory reserved atomically, but without kitchen work items.
8. Staff/POS acceptance must be race-safe and create kitchen work items before station print jobs. Rejection releases the existing order reservation through the current lifecycle.
9. Reuse existing public menu, modifier, hydration, inventory, tracking, restaurant socket, and table-session patterns.
10. Expose proof images only through the existing by-weight proof rule.
11. Keep the public mobile UI accessible, responsive, and usable at 390x844 and 430x932.

## Acceptance criteria

- Scanning a valid table QR still works without login.
- The phone prompt is optional and is not reopened repeatedly after a decision in the same browser session.
- The backend returns the demo OTP only outside production and never stores a plaintext permanent OTP.
- A registered phone is not linked until the customer explicitly confirms after OTP verification.
- Skipping, declining, or closing identity dialogs produces an anonymous order with no customer id.
- A missing registered account creates/reuses a temporary guest only after successful OTP verification.
- Submitted items are rehydrated and repriced by the server; client names/prices/totals are not trusted.
- Repeated submit with the same idempotency key returns the existing order.
- Inventory conflicts return a clear out-of-stock error and do not create a partial order.
- Pending QR orders appear in the existing incoming-order queue and do not appear in the kitchen until accepted.
- Only one staff/POS actor can accept a pending order.
- Public table items show by-weight proof images when staff uploads them.
- No new dependency is added.

## Out of scope

- A production SMS provider or paid SMS delivery.
- Persistent anonymous cart holds while the customer is only browsing. The demo reserves inventory atomically when the batch is submitted.
- Web Push/SMS notifications after the browser is closed.
- Multiple independently owned customer accounts on one table session.
- Replacing the existing customer account login or loyalty settlement rules.

## Validation plan

- Backend targeted Vitest for table tokens, OTP identity, anonymous/linked order creation, idempotency, inventory conflict, and accept race.
- Frontend targeted Vitest for skip, OTP, registered confirmation, guest link, cart and submit payload.
- `npm run check:graphql:operations`.
- `npm run check:conflicts`.
- `npm run build`.
- Browser smoke at desktop, 390x844 and 430x932 when a runtime is available.
