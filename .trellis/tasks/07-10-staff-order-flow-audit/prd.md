# Staff order flow audit

## Current behavior

The `/staff/orders` route already receives its restaurant list from `AuthProvider`. The broken interaction was inside the table map: `StaffOrdering` maps table fields to `tableCode`/`guests`, while `TableMap` read `code`/`capacity`; the map also rendered buttons inside another button and emitted quick-action names that its parent did not handle.

Persisted order-item adjustment mutations loaded orders directly by id. The shared order access guard protected creation, payment and reminder operations but not quantity adjustment, void or return mutations. Their legacy realtime calls also used the wrong `emitOrderEvent` signature. Cashier UI exposed payment requests even though the seeded cashier role does not have the backend `order.update` permission required by that mutation.

## Direction

Keep the existing staff POS, side-panel actions and backend order lifecycle. Remove disconnected duplicate controls, align the table DTO, enforce persisted-order permissions at the shared guard boundary and publish successful item updates through the normal restaurant event channel.

## Acceptance criteria

- Table code and capacity render from the fetched staff-order table data.
- Selecting a table remains the single entry into the connected side-panel flow for opening menu and viewing/requesting payment.
- Table-map cards show available tables as ready and every active table as being served, rather than inferring payment state from the table record.
- The staff table card contains no nested buttons or disconnected quick actions.
- Quantity adjustment and void/return request/review operations verify persisted restaurant scope and the correct order permission before mutation logic runs.
- Successful persisted-item mutations emit `ORDER_UPDATED` with the real resolver context and restaurant id.
- Cashier controls remain read-only until the backend role is explicitly granted an order mutation permission; the UI no longer offers an action that is guaranteed to fail.
- Existing inventory reservation, kitchen work-item sync and table-customer hydration remain unchanged.

## Out of scope / audit findings

- The remote-order queue is still a static empty state; no pending remote-order query is connected yet.
- Table merge/split is not implemented inside the staff screen.
- The selected-table side panel still derives its label from the legacy local `checkout` status mapper; the table-map card no longer exposes that false label, but the parent mapper should be removed when `StaffOrdering.jsx` is split into testable modules.
- Replacing alert/prompt interactions across the whole POS.
- Changing role assignments or restaurant membership rules.
