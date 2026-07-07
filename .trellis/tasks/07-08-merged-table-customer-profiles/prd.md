# Preserve customer profiles on merged tables

## Current behavior

`TableCustomer` stores one customer profile per physical table. The composite merge flow creates a separate visible `Table` record and hides its source tables through `mergedIntoTableId`.

The existing singular `tableCustomer` query looked up the composite table ID/code. No customer row belongs to that new ID, so the UI appeared to lose the customers even though their source rows remained in MongoDB.

The manager table-detail modal also had no customer section capable of rendering more than one source profile.

## Root cause

The merge data model preserves source tables, but the customer read contract and UI still assumed one visible table equals one customer row. They did not follow `mergedFromTableIds` back to the source tables.

## Implemented end-to-end flow

1. `TableCustomer` keeps its original `tableId` and `tableCode`; merge never copies or deletes customer rows.
2. The composite `Table` stores source IDs in `mergedFromTableIds`.
3. `tableCustomerGroup` resolves the visible table, loads every source table, and returns one profile slot per source.
4. Each profile includes `sourceTableId`, `sourceTableCode`, and a nullable customer row.
5. The manager table-detail modal displays every profile as a card labeled with its original table code.
6. Selecting a card edits only that source table's customer row.
7. Aggregate `customerCount` and `totalPartySize` are shown for the composite table.
8. Splitting removes the composite and restores source tables; customer rows immediately reappear because they never moved.

## Scope completed

- Added grouped GraphQL result types and `tableCustomerGroup` query.
- Preserved the existing singular query; legacy clients receive the first available source customer instead of `null`.
- Matched old code-only customer rows by table ID or code when saving, preventing duplicate rows.
- Returned empty source slots when a source table has no customer information.
- Added a source-aware customer panel to `TableActionsLiteModal` through the existing manager-page installer pattern.
- Added per-source profile selection and editing without overwriting another customer's data.
- Marked a composite table `occupied` when a meaningful source customer row exists or a source table is occupied.
- Continued blocking merges when any source has an active order or active reservation.
- Added backend and frontend regression tests.

## Files changed

- `cohan-restaurant-backend/graphql/schema/tableCustomer.graphql`
- `cohan-restaurant-backend/graphql/resolvers/table/tableCustomer.js`
- `cohan-restaurant-backend/graphql/resolvers/table/mergeTables.js`
- `src/utils/installMergedTableCustomerProfiles.js`
- `src/components/Dashboard_Manager/Table/TableCustomerProfilesEnhancement.css`
- `src/main.jsx`
- `cohan-restaurant-backend/tests/resolvers/table-customer-group.test.js`
- `cohan-restaurant-backend/tests/resolvers/table-merge-composite.test.js`
- `src/utils/installMergedTableCustomerProfiles.test.js`

## Acceptance behavior

- Merging A1 and A2 does not delete, move, or overwrite either customer's row.
- Opening A1+A2 shows both profiles, labeled `Bàn A1` and `Bàn A2`.
- The total party size is the sum of both source profiles.
- Saving profile A2 updates A2 only.
- A source without a customer appears as an empty card that can receive a new profile.
- Splitting restores A1 and A2 with their previous customer information.
- A customer-bearing table can merge only when it has no active order or reservation.
- Existing clients using `tableCustomer` no longer receive an empty result for a composite table.

## Out of scope

- Combining or transferring active orders.
- Combining reservations, invoices, or payment sessions.
- Joint billing or payment allocation between source profiles.
- More than one customer profile per physical source table.

## Validation

Added focused checks:

- `vitest run cohan-restaurant-backend/tests/resolvers/table-customer-group.test.js`
- `vitest run cohan-restaurant-backend/tests/resolvers/table-merge-composite.test.js`
- `vitest run src/utils/installMergedTableCustomerProfiles.test.js`

The connected environment could not clone the repository because outbound DNS for GitHub was unavailable. Tests, build, browser smoke testing, and screenshot comparison were therefore not executed here.
