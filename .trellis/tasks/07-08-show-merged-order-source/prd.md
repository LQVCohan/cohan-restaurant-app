# Show source table for merged POS orders

## Current behavior

When two occupied tables are merged, the POS loads every active order batch correctly, but the right panel labels them only as `Đợt 1`, `Đợt 2`, and so on. Staff cannot tell whether a batch originally belonged to V102 or V103.

## Root cause

The backend already exposes the complete source relationship through `Table.mergeDetails`: each source table contains its active order sessions and order codes. The existing `installMergedTableLifecycleUi` enhancer consumes this contract for table cards and payment customer labels, but it does not annotate the POS order batch headers.

## Flow traced

- Persistence: `Order.tableId`, `Order.tableCode`, and `Order.clientMeta.tableMerge` preserve source ownership.
- GraphQL: `Table.mergeDetails` exposes source tables, sessions, and order codes through the existing JSON field.
- Resolver: `resolveTableMergeDetails` builds `sources[].orderSessions[].orderCodes` and `sourceTableCode` without collapsing source sessions.
- Frontend query: `installMergedTableLifecycleUi` already queries `mergeDetails` for all visible tables.
- UI action: the enhancer observes POS DOM updates and currently renders merged table cards and payment labels, but not order-source labels.

## Required behavior

1. Build an order-code-to-source-table lookup from the existing `mergeDetails.sources` payload.
2. Detect the currently selected merged table and each rendered POS batch order code.
3. Add a visible `Bàn V102`/`Bàn V103` label before the existing `Đợt n` title.
4. Avoid incorrect labels when shortened order-code suffixes are ambiguous across sources.
5. Remove stale labels when the selected table is no longer merged.
6. Keep order grouping, payment, kitchen status, and persistence behavior unchanged.

## Acceptance criteria

- A V102 + V103 composite with active orders from both sources visibly identifies each source in the right panel.
- Existing batch title, status, and order-code display remain intact.
- Normal tables do not receive a source badge.
- Repeated MutationObserver runs do not duplicate badges.
- A focused DOM test covers source badge rendering for at least two source tables.

## Out of scope

- Changing merge/split persistence.
- Changing order grouping keys.
- Redesigning the POS order cards.
- Showing customer names per batch.

## Validation plan

- Run `npx vitest run src/utils/installMergedTableLifecycleUi.test.js`.
- Run the narrow frontend build or report explicitly when unavailable.
