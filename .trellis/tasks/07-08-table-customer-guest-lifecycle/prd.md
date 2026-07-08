# Restore table customer guest lifecycle

## Current behavior

1. Saving customer details in `TableActionsModal` upserts `TableCustomer`, but the backend table can remain `available`.
2. The first dine-in order calls `createOrderForTable` without a `customer` payload in manager POS and staff ordering flows.
3. `createOrderForTable` only derives customer identity from an active reservation or the explicit input payload, so a previously saved `TableCustomer` snapshot is ignored.
4. The order is still created and the table becomes `occupied`, but no guest Customer is created/attached and `TableCustomer.customerUserId` remains empty.

## Root cause and flow

Persistence and contract already support the intended lifecycle:

- `TableCustomer` stores name, phone, email and optional `customerUserId`.
- `Customer` supports temporary guests with `isGuest`, `status: pending` and a 30-day `guestExpiresAt`.
- `CreateOrderForTableInput` already supports `customer` and `userId`.
- `ensureUserForOrder` already finds or creates the correct guest and keeps restaurant/customer scoping.

The missing boundary is the handoff from the saved table snapshot to `createOrderForTable`.

Expected flow:

1. Empty table + saved customer details -> persist `TableCustomer` and transition `available -> reserved`.
2. Adding items only changes local cart state.
3. Persisting the first order -> resolve customer from reservation, explicit input, or `TableCustomer` in that order.
4. `ensureUserForOrder` finds/creates the guest.
5. Save guest id to the parent session, order batch, and `TableCustomer.customerUserId`.
6. Existing order flow transitions the table to `occupied`.

## Files to change

- `cohan-restaurant-backend/graphql/resolvers/table/tableCustomer.js`
  - Transition only an `available` matching table to `reserved` after a successful customer upsert.
- `cohan-restaurant-backend/graphql/resolvers/order/mutation.js`
  - Read the table customer snapshot only when reservation/input customer data is absent.
  - Reuse `ensureUserForOrder` and write the resulting id back to `TableCustomer`.
- `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.jsx`
  - Reflect `reserved` locally and refetch tables after customer save.
- `cohan-restaurant-backend/tests/resolvers/table-customer-group.test.js`
  - Prove customer upsert reserves an available table without overwriting other statuses.
- `cohan-restaurant-backend/tests/resolvers/order-mutation-session-userid-scope.test.js`
  - Lock the fallback and `customerUserId` write-back inside the dine-in mutation block.

## Acceptance criteria

- Saving customer information on an available table changes the table to `reserved`.
- Saving customer information does not demote or overwrite `occupied`, `cleaning`, `offline`, or other statuses.
- Merely adding items locally does not create a guest.
- Persisting the first dine-in order uses `TableCustomer` only when no active reservation or explicit customer was supplied.
- A customer with phone/email is found or created as the existing 30-day guest type.
- The resulting guest id is stored in the order/session and `TableCustomer.customerUserId`.
- Existing reservation priority, restaurant permission checks, inventory transaction, order events and `occupied` transition stay unchanged.

## Out of scope

- Creating a guest immediately when customer details are typed.
- Changing the 30-day guest expiration/registration upgrade logic.
- New GraphQL fields, collections or dependencies.
- Redesigning the modal.

## Validation plan

- `npx vitest run tests/resolvers/table-customer-group.test.js tests/resolvers/order-mutation-session-userid-scope.test.js` from `cohan-restaurant-backend`.
- `npm run check:graphql` if available.
- `npm run build` if available.
