# Polish table QR management for production

## Current behavior

The manager table-QR page used a large statistic header and a second full-width usage-flow card, consuming substantial above-the-fold space. Its copy also mixed Vietnamese with implementation-facing terms such as “order”, “public”, “link”, and “copy”.

The QR-to-table data path is correct: the signed token, route, stored token, restaurant, table ID, and table code are cross-checked. However, realtime delivery has two callback naming conventions. QR requests emit `TABLE_CUSTOMER_REQUEST_CREATED` and `TABLE_PAYMENT_REQUESTED`, which `useSocketOrder` routes only to `onTableCustomerRequestCreated` and `onTablePaymentRequested`. `OrderManagement` already listens to the equivalent legacy callbacks `onCustomerStaffCallRequested` and `onCustomerPaymentRequested`, so its specialized toast does not run for QR requests even though the request is stored against the correct table.

## End-to-end flow reviewed

1. `Table` stores the access token, public URL, QR data URL, generated time, and expiry time.
2. `floor_table.graphql` exposes `tableQrAccessList`, `generateTableAccessQr`, and `revokeTableAccessQr`.
3. `tableAccessQr.js` loads the table by ID, signs restaurant ID/table ID/table code, builds the matching route, persists the token, and writes an audit event.
4. `TableCurrentSessionPage` reads restaurant ID/table ID/token from the QR route and sends them for session reads, staff calls, and payment requests.
5. `publicTableSessionQuery.js` and `publicTablePaymentMutation.js` verify the signed values, the stored token, the current table code, and the active table session before reading or writing requests.
6. `publicTablePaymentMutation.js` emits restaurant events containing the verified `tableId` and `tableCode`.
7. `useSocketOrder` dispatches those events to manager-page callbacks.
8. `OrderManagement` shows staff/payment notifications, while `Dashboard` refreshes its support queue.

The QR mapping and backend request ownership are correct. The realtime notification root cause is the missing compatibility routing between the two callback names in the shared socket hook.

## Scope

- Keep the compact table-QR layout, inline summary, disclosure guide, and production Vietnamese wording.
- Route QR staff-call events to `onTableCustomerRequestCreated`, falling back to `onCustomerStaffCallRequested` when the explicit table callback is absent.
- Route QR payment events to `onTablePaymentRequested`, falling back to `onCustomerPaymentRequested` when the explicit table callback is absent.
- Call only one handler per event so pages that already use the new callbacks do not receive duplicates.
- Preserve existing customer-tracking event routing and all backend QR validation.

## Acceptance criteria

- QR links remain bound to the signed restaurant ID, table ID, and current table code.
- A QR staff call reaches the manager handler with the verified `tableCode`.
- A QR payment request reaches the manager handler with the verified `tableCode`.
- `OrderManagement` can keep its existing legacy callbacks and receives both QR request types.
- `Dashboard` continues using the explicit table callbacks without duplicate calls.
- Existing `CUSTOMER_PAYMENT_REQUESTED` and `CUSTOMER_STAFF_CALL_REQUESTED` routing remains unchanged.
- No schema, resolver, permission, token, audit-log, restaurant-scope, or request-persistence changes.

## Out of scope

- Changing QR token lifetime or signing rules.
- Renaming backend event types.
- Adding a new realtime abstraction or dependency.
- Changing the public table experience beyond the existing production copy.

## Validation plan

- Run `vitest run src/hooks/useSocketOrder.test.js`.
- Run `npm run check:conflicts`.
- Run the frontend production build with `npm run build` when the repository runtime is available.
- Manually scan one QR and verify staff-call/payment notifications show the scanned table code.
