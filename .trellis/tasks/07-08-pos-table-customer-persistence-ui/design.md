# Design: POS table customer persistence

## Data contract

`TableCustomer` remains the lightweight per-table customer snapshot. Add `timeFrom` beside the existing `timeTo` so the modal can restore the complete schedule without creating a Reservation.

Older callers are allowed to omit `timeFrom`; the resolver must not erase an existing value unless the caller explicitly sends `null`.

## Source priority

The modal resolves customer data in this order:

1. Active Reservation for a reserved table.
2. Active order customer for an occupied table.
3. Persisted `TableCustomer` snapshot.

A successful reservation lookup with `data: null` means no reservation and must not block the snapshot fallback.

## Refresh behavior

After a successful `upsertTableCustomer`, the modal awaits its `onUpdated` callback. In POS this callback is `refetchTables`, so the card status changes from available to reserved immediately. Socket refresh remains a secondary realtime path.

## UI

Keep the existing modal and orange design language. Improve only the customer section:

- visible labels for every field;
- explicit `Số khách` label and capacity hint;
- separate schedule toggle;
- labeled date, arrival time, and end time;
- responsive one-column collapse on narrow screens;
- no new dependency or modal abstraction.
