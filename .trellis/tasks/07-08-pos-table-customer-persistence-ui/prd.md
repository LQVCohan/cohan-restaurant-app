# POS table customer persistence and form clarity

## Current behavior

- The `− number +` control is unlabeled, so staff cannot tell that it represents party size.
- Saving customer information changes an available table to reserved in the backend, but the current POS list may not refresh until a manual page reload.
- Reopening a reserved table can show an empty customer form even though `TableCustomer` exists.
- The form captures both arrival and end time, but `TableCustomer` stores only the end time, so arrival time cannot be restored.

## Root cause

1. The customer section renders placeholders only and uses an inline party-size stepper without a field label.
2. The regular customer-save path calls `upsertTableCustomer` but does not invoke the POS `onUpdated` callback afterward.
3. The hydration effect returns immediately for every `reserved` table. This is only correct when an actual active reservation was loaded; it is wrong for tables marked reserved by a saved `TableCustomer` snapshot.
4. The persisted contract contains `timeTo` only, while the UI owns both `checkinTime` and `checkinTimeTo`.

## End-to-end flow

`TableCustomer model -> tableCustomer GraphQL schema -> tableCustomer resolver -> Q_TABLE_CUSTOMER / UPSERT_TABLE_CUSTOMER -> TableActionsModal state -> LeftPanel onUpdated/refetchTables -> POS table card`

Active reservations keep priority:

`Reservation -> activeReservationByTable -> TableActionsModal reservation hydration`; only when no active reservation exists does the modal hydrate from `TableCustomer`.

## Required behavior

1. Every customer field has a visible label.
2. The stepper is explicitly labeled `Số khách`, includes the table capacity hint, and has accessible increment/decrement names.
3. Saving customer information refreshes the POS table list immediately and keeps realtime socket refresh as a secondary path.
4. Reopening a table restores name, phone, email, party size, date, arrival time, end time, and note.
5. A real active reservation remains the authoritative source for reserved tables.
6. Existing order-customer behavior, restaurant scoping, permissions, and table status rules remain unchanged.

## Files

- `cohan-restaurant-backend/models/tableCustomer.model.js`: add persisted `timeFrom`.
- `cohan-restaurant-backend/graphql/schema/tableCustomer.graphql`: expose and accept `timeFrom`.
- `cohan-restaurant-backend/graphql/resolvers/table/tableCustomer.js`: persist `timeFrom` through the existing upsert.
- `cohan-restaurant-backend/tests/resolvers/table-customer-group.test.js`: cover the new contract.
- `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.jsx`: request/write/hydrate both times, remove the incorrect reserved-table skip, refresh after save, and add semantic labels.
- `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.module.scss`: targeted customer-form spacing and labels.
- `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.customer.test.jsx`: cover reserved-table snapshot hydration and post-save refresh.

## Validation

- Targeted backend Vitest for `table-customer-group.test.js`.
- Targeted frontend Vitest for `TableActionsModal.customer.test.jsx`.
- `npm run check:graphql`.
- Frontend build when the environment permits it.

## Out of scope

- Redesigning the entire table action modal.
- Changing reservation creation/editing rules.
- Changing table merge/order/payment behavior.
- Adding dependencies.
