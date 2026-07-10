# Single default warehouse UI

## Current behavior

`createRestaurant` already creates one active warehouse named `Kho chính` with code `MAIN` in the same MongoDB transaction. The manager storage screen still exposed a warehouse selector even though the product only needs the restaurant's first/default warehouse.

## Root cause

The warehouse query and manager header still presented the old multi-warehouse model, while all normal restaurant creation already establishes one default warehouse.

## End-to-end flow

`Restaurant` / `Warehouse` models -> `createRestaurant` transaction -> `warehouses` query -> `StorageManagement` automatically selects the returned warehouse -> stock/recipe/supply UI.

## Scope

- Keep automatic `Kho chính / MAIN` creation in `createRestaurant` unchanged.
- Return only the earliest active warehouse from the scoped `warehouses` query.
- Remove the warehouse selector from the manager storage header.
- Keep the existing zero-warehouse recovery state for historical inconsistent data.
- Keep backend warehouse mutations and GraphQL types for compatibility; do not perform a breaking API removal.

## Acceptance criteria

- New restaurant creation still creates one default warehouse transactionally.
- The manager storage page no longer exposes a multi-warehouse selector.
- Normal stock queries and actions use the single default warehouse returned for the restaurant.
- Existing ingredient, supply, recipe, stock and inventory tabs remain unchanged.
- Restaurant and inventory permission checks remain in place.

## Files

- `cohan-restaurant-backend/graphql/resolvers/inventory/warehouse.query.js`
- `cohan-restaurant-backend/tests/resolvers/inventory-restaurant-access.test.js`
- `src/components/Dashboard_Manager/Storage/layout/Header/Header.jsx`
- `src/components/Dashboard_Manager/Storage/StorageManagement.test.jsx`

## Out of scope

- Removing warehouse mutations from the GraphQL schema.
- Database migration or deletion of historical additional warehouses.
- Changing warehouse or stock models.
- Changing the transactional restaurant-creation behavior.
- Removing the legacy first-warehouse recovery action.

## Validation plan

- Focused inventory resolver test.
- Focused `StorageManagement` component test.
- GraphQL operation validation.
- Conflict check and production build when a runnable checkout is available.
