# Show source table for merged POS orders

## Current behavior

When two occupied tables are merged, the POS loads every active order batch correctly, but the right panel labels them only as `Đợt 1`, `Đợt 2`, and so on. Staff cannot tell whether a batch originally belonged to V102 or V103.

## Root cause

The order query already returns `tableCode`, and merged-order metadata may also expose `clientMeta.tableMerge.sourceTableCode`. `useOrderManagement` flattens each order into item rows but does not preserve either source-table value. `RightPanel` therefore has no source identity to render.

## Flow traced

- Persistence: `Order.tableId`, `Order.tableCode`, and `Order.clientMeta` preserve order/table ownership.
- GraphQL: `Order.tableCode` and `Order.clientMeta` are available through the existing `Order` type.
- Resolver: composite table queries load active batches from all physical source table IDs without collapsing them.
- Apollo hook: `ACTIVE_TABLE_SESSION_ORDERS` and `ORDERS_GROUPED_BY_TABLE` feed `loadGroupsForTable`.
- UI: flattened items are grouped by source order and rendered by `RightPanel` batch headers.

## Required behavior

1. Preserve `sourceTableCode` while mapping every existing order item.
2. Prefer `clientMeta.tableMerge.sourceTableCode`; fall back to the order's `tableCode`.
3. On a merged/composite table, render batch headers such as `Bàn V102 · Đợt 1` and `Bàn V103 · Đợt 2`.
4. Do not add redundant source labels when the batch source is the same as the currently selected normal table.
5. Keep order grouping, payment, kitchen status, and persistence behavior unchanged.

## Acceptance criteria

- A V102 + V103 composite with active orders from both sources visibly identifies each source in the right panel.
- A normal V102 order continues to show only `Đợt n`.
- Source metadata is preserved in both active-session and grouped-query fallback mapping paths.
- A focused test guards the Apollo selection, mapper, and rendered label condition.

## Out of scope

- Changing merge/split persistence.
- Changing order grouping keys.
- Redesigning the POS order cards.
- Showing customer names per batch.

## Validation plan

- Run the focused Vitest file for merged source-table labels.
- Run the narrow frontend build or report explicitly when unavailable.
