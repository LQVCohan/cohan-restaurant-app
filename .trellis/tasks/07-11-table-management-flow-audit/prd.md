# Audit and harden table management flows

## Current behavior

The table module spans manager table CRUD, floors and floor-map placement, POS actions, composite merge/split, table customers, QR access and customer-facing table queries. Most flows already have restaurant permission checks and focused tests, but several shared boundaries still allow inconsistent or failing states.

## Confirmed root causes

1. `createTable` loads a floor only by ID to derive `floorLevel`; it does not verify that the floor belongs to the input restaurant before creating the table.
2. `swapTableCodes` performs three independent writes without a transaction. A failure after the temporary code write can leave one or both tables partially changed. It also permits the same table ID on both sides and does not await the audit log.
3. Table search builds `RegExp` directly from user text. Invalid regex characters can throw and ordinary punctuation is interpreted as regex syntax instead of literal search text.
4. Table update/move optimistic responses are incomplete. The move path reads from `window.__APOLLO_CLIENT__` and can call `readFragment` on a non-cache object; the update path writes a sparse object against the full table fragment.

## End-to-end flow traced

1. `table.model.js` defines restaurant/floor scope, status, position, QR, booking and composite-table fields.
2. `floor_table.graphql` exposes table/floor queries and CRUD, status, move, swap, merge, split and QR mutations.
3. `table/index.js` composes the active resolvers: base mutations, composite merge/split/delete overrides, dedicated move override, QR and table-customer operations.
4. `table/query.js`, `table/mutation.js`, `mergeTables.js` and `moveTable.js` enforce access, state guards, transactions and audit logging.
5. `useTableManagement.js` owns Apollo operations and cache updates.
6. `TableManagement`, `TableActionsLiteModal` and POS `TableActionsModal` invoke those operations and then refresh caller-owned table lists.
7. Existing resolver/component tests cover merge lifecycle, active order/reservation guards, restaurant access, QR/public ordering and UI actions.

## Scope

- Reject table creation when the selected floor belongs to another restaurant.
- Make code swapping atomic, reject self-swap, verify both writes and preserve audit logging.
- Treat search input as literal text and clamp query limits to the supported range.
- Remove unsafe optimistic table update/move payloads; retain server-result cache updates.
- Add focused regression tests for each defect.

## Acceptance criteria

- A table can never be created against a floor from another restaurant.
- Swapping two table codes either completes fully or leaves both tables unchanged.
- Swapping a table with itself is rejected before any write.
- Search strings containing regex punctuation do not crash and match literally.
- Table list limits stay between 1 and 500.
- Updating or moving a table does not depend on a global Apollo client and does not write incomplete optimistic entities.
- Existing composite merge/split, delete guards, POS, floor-map, QR, table-customer and 360 flows remain unchanged.

## Out of scope

- Reintroducing 3D/AR table placement or persisting legacy `visualConfig` from active UI flows.
- Schema or database migrations.
- Redesigning table-management screens.
- Changing order, reservation, payment or QR business rules.
- Removing overridden legacy resolver methods in the same change.

## Validation plan

- Run the focused backend table audit test.
- Run `src/hooks/useTableManagement.test.jsx`.
- Run existing table access and composite merge tests.
- Run GraphQL operation/schema checks and frontend build when the environment permits.
