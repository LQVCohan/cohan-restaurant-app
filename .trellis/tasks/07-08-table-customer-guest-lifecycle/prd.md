# Restore table customer guest lifecycle

## Previous behavior

1. Saving customer details in `TableActionsModal` upserted `TableCustomer`, but the backend table could remain `available`.
2. The first dine-in order called `createOrderForTable` without a `customer` payload in manager POS and staff ordering flows.
3. `createOrderForTable` derived customer identity only from an active reservation or explicit input, so the saved `TableCustomer` snapshot was ignored.
4. The order was created and the table became `occupied`, but no guest Customer was created/attached and `TableCustomer.customerUserId` remained empty.

## Root cause and preserved contracts

The existing contracts were already correct:

- `TableCustomer` stores name, phone, email and optional `customerUserId`.
- `Customer` supports temporary guests with `isGuest`, `status: pending` and a 30-day `guestExpiresAt`.
- `CreateOrderForTableInput` already supports `customer` and `userId`.
- `ensureUserForOrder` already finds or creates the correct guest and preserves restaurant/customer scoping.
- The existing dine-in mutation already changes the table to `occupied` after a successful first order.

The missing boundary was the handoff from the table snapshot to the first persisted order.

## Restored flow

1. Empty table + saved customer details -> persist `TableCustomer` and conditionally transition only `available -> reserved`.
2. Emit `TABLE_CUSTOMER_UPDATED`; the existing restaurant socket distributes the event and table hooks refetch only the matching `restaurantId`.
3. Adding items still changes only local cart state and does not create a Customer.
4. Persisting the first order resolves identity in this priority order: active reservation -> explicit order input -> saved `TableCustomer`.
5. The existing `ensureUserForOrder` flow finds a registered Customer, refreshes an existing guest, or creates the existing 30-day guest type.
6. The resulting Customer id is saved to the parent table session/order batch and written back best-effort to `TableCustomer.customerUserId`.
7. The existing order mutation changes the table from `reserved` to `occupied`.

## Files changed

- `cohan-restaurant-backend/graphql/resolvers/table/tableCustomer.js`
  - Reserves only an `available` matching table after a successful customer upsert.
  - Emits `TABLE_CUSTOMER_UPDATED` only when that status transition actually occurred.
- `cohan-restaurant-backend/graphql/resolvers/order/tableCustomerOrderLifecycle.js`
  - Reuses the repository's resolver-wrapper pattern instead of enlarging `mutation.js`.
  - Reads the saved table snapshot only when no explicit user/customer was supplied.
  - Resolves by current phone/email before falling back to a stored id, preventing an expired 30-day guest id from blocking a new order.
  - Writes the resolved id back without turning a secondary snapshot failure into a duplicate-order retry.
- `cohan-restaurant-backend/graphql/resolvers/order/index.js`
  - Installs the wrapper inside the existing merged-table/payment/conflict/access lifecycle.
- `src/hooks/useSocketOrder.js`
  - Broadcasts the table-customer socket event through the same browser-event pattern already used for menu availability.
- `src/hooks/useTableManagement.js`
  - Refetches tables only when the event belongs to the hook's current restaurant.
- `cohan-restaurant-backend/tests/resolvers/table-customer-group.test.js`
  - Covers the conditional reservation and emitted restaurant event.
- `cohan-restaurant-backend/tests/resolvers/table-customer-order-lifecycle.test.js`
  - Covers snapshot hydration, explicit-customer precedence, stale guest-id handling and best-effort writeback.
- `src/hooks/useTableManagement.test.jsx`
  - Covers restaurant-scoped realtime refetch without changing caller-owned merge/split behavior.

## Acceptance criteria

- Saving customer information on an available table changes the table to `reserved`.
- Saving customer information does not demote or overwrite `occupied`, `cleaning`, `offline`, or other statuses.
- The table list refreshes for the correct restaurant after the reservation transition.
- Merely adding items locally does not create a guest.
- Persisting the first dine-in order uses `TableCustomer` only when no active reservation or explicit customer was supplied.
- A customer with phone/email is found or created through the existing 30-day guest flow.
- The resulting guest id is stored in the order/session and written back to `TableCustomer.customerUserId`.
- Existing reservation priority, restaurant permission checks, inventory transaction, order events and `occupied` transition remain unchanged.

## Out of scope

- Creating a guest immediately when customer details are typed.
- Changing the 30-day guest expiration/registration upgrade logic.
- New GraphQL fields, collections or dependencies.
- Redesigning the modal.

## Validation plan

- From `cohan-restaurant-backend`: `npx vitest run tests/resolvers/table-customer-group.test.js tests/resolvers/table-customer-order-lifecycle.test.js`.
- From the frontend root: `npx vitest run src/hooks/useTableManagement.test.jsx`.
- Run the repository GraphQL check and production build when an executable checkout is available.

## Validation result

The connected GitHub environment does not expose a runnable checkout, so the focused Vitest commands, GraphQL check and build were not executed here. No test/build pass is claimed.
