# Complete merged-table lifecycle

## Current behavior

The composite merge resolver creates a new visible table and hides its physical source tables. It currently rejects every active reservation and every active order. Customer rows remain on source tables, but order queries and payment use only one active table session.

## Root cause

The table merge contract models only table geometry. Reservation ownership, order-session ownership, payment aggregation and source-table identity are not part of the merge lifecycle. Queries therefore assume one visible table has one reservation, one active session and one customer.

## Required behavior

1. Empty tables can always merge when they belong to the same restaurant and floor.
2. One selected table may have an active reservation. The reservation moves to the composite table and returns to its source table on split.
3. Two or more selected source tables with active reservations cannot merge.
4. A table with active orders can merge with an empty table.
5. Two order-bearing tables can merge. Their existing order sessions remain distinct and each keeps its source table identity.
6. New orders created after merge are assigned to a selected source table, or to the merge anchor when no source is supplied.
7. Split restores reservations, sessions and order batches to their physical source tables without copying or deleting business records.
8. Payment for a composite table includes every active order batch from every source session and closes all included parent sessions after successful payment.
9. Source `TableCustomer` rows remain unchanged. Composite details return every customer and a compact label such as `Nguyễn An + Trần Bình`.
10. The composite table uses a new queryable ID/code, summed capacity and a bounding position covering its source tables.
11. POS/table UI refreshes immediately and displays source tables, customers, reservations, order sessions and open amount.

## Acceptance criteria

- Merging A1 + A2 creates one visible table with a new ID, code `A1+A2`, summed capacity and source IDs.
- A1 reservation + empty A2 succeeds and the reservation is queryable through A1+A2.
- Active reservations on both A1 and A2 return `TABLE_MULTIPLE_ACTIVE_RESERVATIONS` and create nothing.
- Active order(s) on A1 + empty A2 succeed; every active order points to A1+A2 while retaining A1 as origin.
- Active sessions on both A1 and A2 succeed and remain separately identifiable in the composite response.
- Splitting restores each reservation/order to A1 or A2 and deletes only the composite table.
- Paying A1+A2 generates one invoice from all payable active batches and closes all source sessions.
- Customer cards stay attached to A1/A2, while composite details and payment UI show both names.
- Existing restaurant permission, floor isolation, inventory, kitchen and audit behavior remains intact.

## Out of scope

- Splitting one merged invoice after it has already been paid.
- Moving a composite table across floors before splitting.
- Merging tables from different restaurants or floors.
- Automatically deciding which source customer owns a new post-merge order when the caller explicitly selects neither; the anchor is the deterministic fallback.

## Validation plan

- Targeted backend resolver tests for merge/split scenarios.
- Targeted payment aggregation test.
- GraphQL schema check.
- Frontend component test for composite summary rendering.
- Narrow build/check commands when the execution environment permits them.
