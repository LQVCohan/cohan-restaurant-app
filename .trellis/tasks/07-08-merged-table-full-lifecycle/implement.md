# Implementation plan

## Backend

1. Extend Table and Reservation persistence with the minimum merge-origin fields.
2. Replace the composite merge/split resolver with one transaction covering Table, Reservation and Order.
3. Add `mergeDetails` resolver and GraphQL result fields.
4. Add an order lifecycle wrapper that validates and stamps source-table metadata on new composite orders.
5. Update composite order queries to return every active order batch/session.
6. Add a payment override that aggregates every active composite order and closes all parent sessions.

## Frontend

1. Extend the shared table fragment and merge result.
2. Refetch the table list after merge/split so the newly created/deleted composite is visible immediately.
3. Render composite source/customer/order/reservation summaries in POS and expand the merged card.
4. Show the combined customer label in checkout.

## Tests

1. Empty + empty merge.
2. One reservation + empty merge and split restore.
3. Two active reservations rejected.
4. One active order + empty merge and split restore.
5. Two active sessions preserved and included in one payment.
6. Merge details serialization and UI summary.

## Files and reason

The implementation changes only persistence contracts, shared lifecycle boundaries, the GraphQL read contract, and the two POS presentation points that consume it. Existing inventory, kitchen, order-item and discount calculations remain unchanged and are reused.
