# Fix POS table merge feedback

## Current behavior

In POS, merging two empty tables commits successfully in the backend and the GraphQL response is successful, but the drag-drop UI still shows the native alert `Gộp bàn thất bại.`. Splitting succeeds and must keep its success feedback.

## Root cause

`useTableManagement.mergeTables` and `splitTables` still invoke `refetch()` after the successful mutation. The previous guard only handles a rejected Promise. If `refetch()` throws synchronously while being called, the shared wrapper rejects after the backend transaction has already committed, so `LeftPanel` enters its failure catch and displays the native alert.

The refresh is redundant inside the hook because every real merge/split UI caller already refreshes after a successful result:

- POS drag-drop calls `refreshTables()`.
- POS table modal calls `onUpdated`, which is `refreshTables`.
- Manager table modal calls `onUpdated`, which is `refetchTables`.

## Caller flow

`Table/Reservation models -> mergeTables/splitTables resolver -> GraphQL mutation -> useTableManagement -> PosContext -> LeftPanel/TableActionsModal -> caller-owned refresh and notification`

## Required behavior

1. A successful backend merge resolves successfully regardless of any refresh behavior.
2. A successful split resolves successfully regardless of any refresh behavior.
3. The shared hook emits merge/split success notifications only after a successful mutation.
4. A real GraphQL mutation error still rejects and does not show success.
5. Existing UI callers remain responsible for refreshing their table list.

## Files

- `src/hooks/useTableManagement.js`: remove redundant hook-owned `refetch()` calls from merge/split wrappers.
- `src/hooks/useTableManagement.test.jsx`: prove merge/split do not call or depend on `refetch`, including a synchronous-throwing refetch mock.

## Validation

- Targeted Vitest for `src/hooks/useTableManagement.test.jsx`.
- Frontend build if the connected environment permits it.

## Out of scope

- Changing backend merge/split business rules.
- Redesigning the merge picker.
- Changing table/order/reservation persistence.
