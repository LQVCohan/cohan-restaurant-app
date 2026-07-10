# Design — Table QR session verification

## Token layers

1. **Printed QR token**: long-lived, scoped to restaurant/table, identifies the physical table only.
2. **Access request token**: 5-minute JWT scoped to restaurant/table/tableSession/request/device hash.
3. **Order session token**: short-lived JWT scoped to the confirmed active table session and browser device.
4. **Identity token**: optional customer-profile link; it never replaces the order session token.

## Confirmation handshake

1. Customer scans printed QR.
2. Public query returns table code/status and whether an active table session exists, but hides order details without an order session token.
3. Customer presses “Yêu cầu mã xác nhận”. Backend appends a pending request to the active table session `clientMeta.qrOrderAccessRequests`.
4. POS polls the staff-only request list. Staff goes to the table, matches the request label, presses “Đã tới bàn – hiện mã”, and reads the 6-digit code to the customer.
5. Customer enters the code. Backend validates HMAC code and atomically marks the request confirmed.
6. Backend stores the order-session token and browser device id in table-scoped HttpOnly cookies. Frontend JavaScript never persists or attaches the session token itself.

## Persistence

`table_session.clientMeta.qrOrderAccessRequests` contains at most the newest 8 request records:

```js
{
  requestId,
  requestLabel,
  deviceHash,
  status: "pending" | "confirmed",
  requestedAt,
  expiresAt,
  confirmedAt
}
```

The confirmation code is derived with HMAC from session/request/device data and is never persisted.

## Cookie scope

The backend creates a separate cookie pair for each table id:

```text
cohan_table_order_session_<tableId>
cohan_table_order_device_<tableId>
```

Both are HttpOnly, sent only through credentialed API requests, and expire with the signed session token. A cookie for table A is never read while validating table B.

## Validation boundary

A shared helper validates:

- JWT purpose and expiry;
- restaurant/table/session scope;
- device hash;
- the request remains confirmed in the active table session;
- the session is still active and unpaid;
- the table/session capability still accepts orders when the action creates new items.

The helper is used by public order submit, order viewing, staff call, payment request and identity OTP. At `ready_to_pay/payment_requested`, the confirmed device can still view the table state but cannot submit more items. Closing, paying or replacing the table session invalidates the token completely.

## UI direction

Compact sage verification gate with one primary action. Staff UI uses an amber security card and keeps the confirmation code hidden until an explicit 44px action is pressed. Copy tells staff to reveal the code only while standing at the matching table and seeing the request label on the customer device.
