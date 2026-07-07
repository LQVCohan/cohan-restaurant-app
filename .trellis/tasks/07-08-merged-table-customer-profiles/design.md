# Design: source-aware customer profiles for composite tables

## Data ownership

Customer ownership remains on each physical source table:

- `TableCustomer.tableId` and `tableCode` continue to reference the original table.
- `Table.mergedFromTableIds` identifies the physical tables represented by a composite table.
- No customer row is copied to the composite table during merge.
- A split only restores source-table visibility; customer migration is unnecessary.

This avoids duplicate data, stale copies, ambiguous ownership, and destructive split logic.

## GraphQL contract

```graphql
type TableCustomerProfile {
  sourceTableId: ID!
  sourceTableCode: String!
  customer: TableCustomer
}

type TableCustomerGroup {
  tableId: ID!
  tableCode: String!
  isMerged: Boolean!
  customerCount: Int!
  totalPartySize: Int!
  profiles: [TableCustomerProfile!]!
}

query tableCustomerGroup(
  restaurantId: ID!
  tableId: ID
  tableCode: String
): TableCustomerGroup!
```

A normal table returns one source slot. A composite table returns one slot per `mergedFromTableIds`. A slot remains present with `customer: null` when no information has been entered.

The singular `tableCustomer` query remains available for old clients. When called with a composite table and no direct row, it returns the first populated source profile rather than reporting no customer.

## Resolver algorithm

1. Validate restaurant access.
2. Resolve the visible table by ID, preferred over code.
3. Expand `mergedFromTableIds`; otherwise use the visible table itself.
4. Load source-table codes and all matching `TableCustomer` rows by table ID or legacy table code.
5. Join rows to sources and order profiles by source-table code.
6. Count populated profiles and sum non-negative party sizes.
7. Upsert by source ID **or** source code so old code-only records are upgraded instead of duplicated.

## Manager table-detail interaction

The existing manager modal remains the owner of table actions. A small installer adds a customer section after `.talite-info`, following the same repository pattern as the searchable merge picker.

- The section shows source-table count, customer-profile count, and total guests.
- Each source table is a selectable card labeled `Bàn <source code>`.
- Cards show customer name, contact information, and party size.
- Empty sources remain visible and can receive a new profile.
- Selecting a card opens an inline editor.
- Saving always submits `sourceTableId` and `sourceTableCode`, never the composite table ID.
- User data is rendered through `textContent`/form values rather than interpolated HTML.
- Layout collapses to one column on narrow screens and preserves visible keyboard focus.

## Merge rules

- Allowed source statuses: `available`, `occupied`.
- Active order or active reservation remains a hard block.
- Meaningful `TableCustomer` data is checked before creating the composite.
- Composite status is `occupied` when any populated source customer exists or any source is occupied; otherwise it is `available`.
- Customer rows are not part of the merge write and require no rollback.

## Split behavior

The composite split deletes the visible composite table and clears `mergedIntoTableId` from every source. Since customer rows remained attached to source IDs throughout the merge, each original table immediately regains its own customer information.

## Compatibility boundary

Old POS/staff code that requests one customer receives a non-empty fallback. Full multi-customer display and editing use `tableCustomerGroup`; active order merging and combined billing remain deliberately unsupported.
