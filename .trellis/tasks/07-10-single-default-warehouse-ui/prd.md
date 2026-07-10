# Single default warehouse UI

## Current behavior

`createRestaurant` already creates one active warehouse named `Kho chính` with code `MAIN` in the same MongoDB transaction. The manager storage screen still exposes a warehouse selector, a warehouse-count KPI, and a manual `createWarehouse` recovery action for restaurants with no warehouses.

## Root cause

The frontend still presents the old multi-warehouse model even though the desired product behavior is one automatically created default warehouse per restaurant.

## End-to-end flow

`Restaurant` / `Warehouse` models -> `createRestaurant` transaction -> `warehouses` query -> `StorageManagement` selects the first active warehouse -> stock/recipe/supply UI.

## Scope

- Keep automatic `Kho chính / MAIN` creation in `createRestaurant` unchanged.
- Use the first active warehouse automatically for all storage-page operations.
- Remove the warehouse selector, warehouse-count KPI, and manual create-warehouse action from the manager UI.
- Keep an explanatory error state for legacy restaurants that have no warehouse.
- Remove the now-unused frontend `CREATE_WAREHOUSE` operation.
- Keep backend warehouse schema/resolvers for compatibility; do not perform a breaking GraphQL removal.

## Acceptance criteria

- New restaurant creation still creates exactly one default warehouse transactionally.
- The storage page does not expose warehouse selection or creation controls.
- Stock queries and actions use the first active warehouse returned for the selected restaurant.
- A restaurant with no warehouse shows a clear data/setup error and no create button.
- Existing ingredient, supply, recipe, stock and inventory tabs remain unchanged.

## Files

- `src/components/Dashboard_Manager/Storage/StorageManagement.jsx`
- `src/components/Dashboard_Manager/Storage/layout/Header/Header.jsx`
- `src/components/Dashboard_Manager/Storage/graphql/inventory.gql.js`
- `src/components/Dashboard_Manager/Storage/StorageManagement.test.jsx`

## Out of scope

- Removing warehouse mutations from the public GraphQL schema.
- Database migration for historical restaurants.
- Changing warehouse or stock models.
- Changing the transactional restaurant-creation behavior.

## Validation plan

- Focused `StorageManagement` component test.
- GraphQL operation validation.
- Conflict check and production build when a runnable checkout is available.
