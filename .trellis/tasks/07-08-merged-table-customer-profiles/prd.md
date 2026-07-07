# Preserve customer profiles on merged tables

## Current behavior

`TableCustomer` stores one customer profile per physical table. The new merge flow creates a separate composite `Table` record and hides its source tables through `mergedIntoTableId`.

The POS modal still calls the singular `tableCustomer` query with the composite table ID/code. No `TableCustomer` row exists for that new ID, so the UI hydrates nothing and the source customer profiles appear to have been deleted even though they remain in the database.

The merge resolver also currently requires every source table to be `available`, which prevents a table marked `occupied` only because customer information was recorded from being merged.

## Root cause

The data model correctly preserves the source tables, but the customer read contract is still singular and unaware of `mergedFromTableIds`. The UI assumes one table equals one editable customer row, so it cannot render or edit multiple source profiles after merge.

## End-to-end flow

1. `TableCustomer` keeps the original `tableId` and `tableCode` for each physical table.
2. A composite `Table` stores all source IDs in `mergedFromTableIds`.
3. A new grouped GraphQL query resolves the visible table, expands its source table IDs when it is composite, and returns one profile slot per source table.
4. POS uses the grouped query, displays all source customers, and edits the selected source profile without creating a replacement row on the composite table.
5. Staff ordering uses the same grouped query and derives a combined customer label for the selected merged table.
6. Splitting deletes the composite table and restores the source tables; customer rows require no migration because they never moved.

## Scope

- Add a source-aware grouped customer query while preserving the existing singular query.
- Return profile slots for every source table, including a source table that currently has no customer row.
- Include aggregate customer count and total party size for the merged table.
- Display all customer profiles in the POS table modal with their original table code.
- Allow selecting one profile card and saving changes back to that source table.
- Keep non-merged table behavior unchanged.
- Allow `occupied` source tables to merge only when neither active orders nor active reservations exist.
- Set the composite status to `occupied` when any source table is occupied.
- Update staff table hydration so merged tables retain a combined customer label.

## Constraints

- Do not move or duplicate `TableCustomer` rows during merge.
- Do not merge active orders, invoices, reservations, or payment sessions.
- Do not change the existing `tableCustomer` response type or existing upsert mutation.
- Preserve restaurant access checks and source-table scoping.
- No new dependency.

## Files to change

- `cohan-restaurant-backend/graphql/schema/tableCustomer.graphql`: grouped query and result types.
- `cohan-restaurant-backend/graphql/resolvers/table/tableCustomer.js`: source-aware customer grouping.
- `cohan-restaurant-backend/graphql/resolvers/table/mergeTables.js`: allow safe occupied tables and derive composite status.
- `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.jsx`: grouped query, profile selection, editing target, and summary UI.
- `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.module.scss`: responsive customer profile cards.
- `src/components/Staff/StaffOrdering.jsx`: grouped query and combined customer hydration.
- Narrow backend tests for grouped customer resolution and composite status.

## Acceptance criteria

- Merging two tables with existing customer profiles does not delete or overwrite either profile.
- Opening the composite table shows both customers, each labeled with the original table code.
- The displayed total party size equals the sum of the source customer party sizes.
- Selecting and saving customer A updates customer A's original `TableCustomer` row only.
- Splitting the table restores the original tables with their previous customer information intact.
- A source table with no customer data appears as an empty source slot instead of disappearing.
- An occupied table without active order/reservation may merge; any active order/reservation still blocks merge.
- Existing non-merged table customer flows continue to work.

## Out of scope

- Combining active orders from multiple tables.
- Combining or transferring reservations.
- Joint billing or payment allocation between customer profiles.
- Supporting more than one `TableCustomer` row on the same physical table.

## Validation plan

- `vitest run cohan-restaurant-backend/tests/resolvers/table-customer-group.test.js`
- `vitest run cohan-restaurant-backend/tests/resolvers/table-merge-composite.test.js`
- Existing POS component/build checks when a runnable workspace is available.
- Browser smoke test: merge two customer-bearing tables, inspect both cards, edit one, split, and verify both source profiles return.
