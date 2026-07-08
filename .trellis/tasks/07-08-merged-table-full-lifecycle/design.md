# Design: merged-table lifecycle

## Data ownership

Physical source tables stay in MongoDB and are hidden with `mergedIntoTableId`. The composite table is the visible operational table.

- `Table.mergedFromTableIds` identifies physical sources.
- `Table.mergeAnchorTableId` is the fallback source for new activity.
- `Table.mergedSourceSnapshots` stores source code/status for deterministic restoration and audit.
- `Reservation.sourceTableId/sourceTableCode/tableMergeGroupId` preserves reservation origin.
- Orders preserve origin under `clientMeta.tableMerge` to avoid duplicating schema fields already supported by the JSON metadata contract.

## Merge transaction

1. Validate restaurant, floor, duplicate IDs and existing merge membership.
2. Load active reservations and active dine-in orders for every selected source.
3. Reject when active reservations belong to more than one source table.
4. Create the composite table with summed capacity and a position bounding all source geometry.
5. Mark source tables hidden.
6. Move the single active reservation, when present, to the composite and preserve origin.
7. Move active sessions/order batches to the composite ID/code, preserving source table/session metadata.
8. Emit one audit event after commit.

## Order-session model

Existing parent sessions are not collapsed. Their order batches keep `parentOrderId/rootOrderId`, so kitchen history and each calling round remain intact. Order queries for a composite table load every active batch by composite `tableId`, then group by each original parent/root session.

New post-merge orders accept `clientMeta.tableMerge.sourceTableId`. The server validates it against `mergedFromTableIds`; otherwise it uses `mergeAnchorTableId`.

## Split transaction

1. Load the composite and source tables.
2. Restore each reservation to its preserved source.
3. Restore each active session/order batch to `clientMeta.tableMerge.sourceTableId` and source code.
4. Remove merge metadata from restored business records.
5. Recalculate each source table status from restored active reservation, active order and customer data.
6. Clear source merge links and delete the composite.

## Payment

Composite payment resolves every active order batch by table ID, regardless of parent session. The existing payment mutation already aggregates item lines and totals when given an order list, so the merged-table wrapper delegates to `payOrdersByOrderIds`, then closes every included parent table session and marks the composite available.

## Read/UI contract

`Table.mergeDetails` is resolved only for composite tables and returns:

- source table ID/code/status;
- customer name per source and combined label;
- active reservation code/source;
- distinct source order sessions and order codes;
- aggregate open amount.

The table query includes these fields. The POS card expands for composite tables, shows the source/customer/session summary, and the payment header appends the combined customer label.

## Failure safety

All cross-collection writes run in a MongoDB transaction. Write conflicts and duplicate composite codes return business errors; no source table is left hidden if creation fails.
