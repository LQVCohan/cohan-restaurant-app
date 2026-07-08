# Fix POS table merge feedback

## Current behavior

In POS, merging two empty tables can commit successfully in the backend but still show a failure message. Splitting succeeds but provides no confirmation.

## Root cause

`useTableManagement.mergeTables` and `splitTables` await a follow-up `refetch()` after the mutation. When that refresh rejects, the mutation wrapper rejects too, so POS catch handlers report a business failure even though the backend transaction already committed. POS modal and drag-drop callers also have inconsistent success/error notifications.

## Caller flow

`Table/Reservation models -> mergeTables/splitTables resolver -> GraphQL mutation -> useTableManagement -> PosContext -> LeftPanel/TableActionsModal -> notification`

## Required behavior

1. A successful backend merge must resolve successfully even if the follow-up table refresh fails.
2. A successful split must resolve successfully even if the follow-up table refresh fails.
3. POS modal shows a success notification after merge and split.
4. POS drag-drop merge uses the same success/error wording.
5. A real GraphQL mutation error still shows an error and does not show success.
6. The table list is still refreshed by the existing POS caller after a successful action.

## Files

- `src/hooks/useTableManagement.js`: make merge/split wrappers return only the mutation result; callers already own refresh.
- `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.jsx`: add accurate success/error notifications and isolate refresh failures.
- `src/components/Dashboard_Manager/POS/components/pos/LeftPanel.jsx`: align drag-drop merge feedback.
- `src/hooks/useTableManagement.test.jsx`: verify mutation success is not coupled to refetch.

## Validation

- Targeted Vitest for `useTableManagement`.
- Targeted POS component tests when available.
- Frontend build if the connected environment permits it.

## Out of scope

- Changing backend merge/split business rules.
- Redesigning the merge picker.
- Changing table/order/reservation persistence.
