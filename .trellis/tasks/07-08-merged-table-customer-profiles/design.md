# Design: source-aware customer profiles for composite tables

## Data ownership

Customer ownership remains on the physical source table:

- `TableCustomer.tableId` and `tableCode` continue to reference the original table.
- `Table.mergedFromTableIds` identifies the source tables represented by a composite table.
- No customer row is copied to the composite table during merge.

This avoids duplication, stale copies, and split-time data migration.

## GraphQL contract

Add:

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

For a normal table, `profiles` contains one slot. For a composite table, it contains one slot per `mergedFromTableIds`. A slot may have `customer: null`.

## Resolver algorithm

1. Validate restaurant access and input.
2. Resolve the visible table by ID first, otherwise code.
3. If `mergedFromTableIds` is non-empty, load those source tables; otherwise use the visible table itself.
4. Load all `TableCustomer` rows whose `tableId` matches those source IDs.
5. Join rows by source table ID and return profiles ordered by source table code.
6. Sum non-negative `partySize` values and count non-null customer rows.

## POS interaction

- Show a compact summary with customer count and total guests.
- Render one source card per profile.
- Clicking a card selects its source profile for the existing edit form.
- Saving uses the selected profile's `sourceTableId` and `sourceTableCode`.
- For an empty slot, the form creates the missing row for that source table.
- For a normal table, the only slot is selected automatically, preserving current behavior.

## Merge rules

- Allowed source statuses: `available`, `occupied`.
- Active order or active reservation remains a hard block.
- Composite status is `occupied` if any source is occupied; otherwise `available`.
- Customer records are not part of the merge write and therefore do not need rollback.

## Split behavior

The existing composite split deletes the composite table and clears `mergedIntoTableId` from the source tables. Since customer rows never moved, they immediately become visible on their original tables again.
