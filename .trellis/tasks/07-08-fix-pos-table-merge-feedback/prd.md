# Fix POS table merge feedback and refresh

## Current behavior

In POS, merging two empty tables commits successfully in the backend and the GraphQL response succeeds, but the UI shows `Gộp bàn thất bại.`. Both merge and split only become visible after a manual page refresh.

## Root cause

`PosContext` exposes the table refresh function as `refetchTables`, but `LeftPanel` destructures a non-existent `refreshTables` property.

That mismatch breaks both POS paths:

- Drag-drop merge calls the undefined `refreshTables()` after the successful mutation. The resulting `TypeError` is caught by the merge error handler, which incorrectly shows `Gộp bàn thất bại.`.
- `TableActionsModal` receives `onUpdated={refreshTables}` as `undefined`, so successful merge/split actions do not refresh the POS table list.

## Caller flow

`Table resolver -> GraphQL mutation -> useTableManagement -> PosContext.refetchTables -> LeftPanel -> drag-drop merge / TableActionsModal -> immediate table-list refresh`

## Required behavior

1. POS drag-drop merge refreshes the table list immediately after success.
2. POS modal merge and split refresh the table list immediately after success.
3. A successful merge does not enter the failure alert.
4. A real merge mutation error still shows the existing failure alert.
5. No backend or GraphQL contract changes.

## Files

- `src/components/Dashboard_Manager/POS/components/pos/LeftPanel.jsx`: alias `refetchTables` from context to the existing local `refreshTables` name.
- `src/components/Dashboard_Manager/POS/components/pos/LeftPanel.tableRefresh.test.jsx`: verify drag-drop merge and modal refresh callbacks use `refetchTables`.

## Validation

- Targeted Vitest for the new LeftPanel test.
- Frontend build if the connected environment permits it.

## Out of scope

- Changing merge/split business rules.
- Redesigning the POS table UI.
- Changing order, reservation, or payment behavior.
