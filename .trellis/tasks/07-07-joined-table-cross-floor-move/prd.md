# Block cross-floor moves for joined tables

## Current behavior

The table action modal refuses to move a table with `joinGroupId` to another floor. The GraphQL `moveTable` mutation does not enforce the same rule, so a direct API request can leave one joined group spread across multiple floors.

## Root cause

The invariant exists only in the UI action. It is missing from the server mutation boundary that all clients must obey.

## End-to-end flow

1. `Table.joinGroupId` records group membership.
2. `MoveTableInput` accepts a target floor and optional position.
3. The table mutation authorizes the source restaurant and validates the target floor.
4. `useTableManagement.moveTable` sends the mutation.
5. `TableActionsLiteModal.handleMove` already blocks joined-table cross-floor moves.

## Files to change

- `cohan-restaurant-backend/graphql/resolvers/table/moveTable.js`: preserve the existing move behavior and reject a different target floor while `joinGroupId` is present.
- `cohan-restaurant-backend/graphql/resolvers/table/index.js`: register the guarded resolver for `moveTable`.
- `cohan-restaurant-backend/tests/resolvers/table-move-joined-group.test.js`: cover cross-floor rejection and valid same-floor position updates.

## Acceptance criteria

- A joined table cannot move to another floor through GraphQL.
- The mutation returns a stable `TABLE_JOIN_GROUP_FLOOR_MOVE` error code.
- A joined table can still change position on its current floor.
- An unjoined table can still move to a valid floor in the same restaurant.
- Restaurant permission checks, target-floor ownership validation, and event logging remain intact.
- Schema, Apollo operation, cache behavior, and UI remain unchanged.

## Out of scope

- Moving an entire joined group between floors.
- Automatically splitting a group.
- Changing merge or split behavior.

## Validation plan

- Run the focused resolver test.
- Run backend lint, tests, GraphQL checks, and build through CI.
- Run frontend checks through CI to detect contract drift.
