# Multi-warehouse management

## Current behavior

`createRestaurant` correctly creates the first `Kho chính / MAIN` warehouse transactionally. However, the inventory resolver had been narrowed to return only the first active warehouse, while the storage page and `transferStock` domain support selecting and moving stock between multiple warehouses in the same restaurant. The UI also had no complete create/edit/delete warehouse management surface.

## Root cause

The product was incorrectly narrowed to a single visible warehouse at the query boundary. This hid legitimate warehouses and broke the operational contract required by intra-restaurant stock transfer.

## End-to-end flow

`Warehouse` / `StockItem` models -> warehouse query/mutations and `transferStock` -> inventory GraphQL operations -> storage header warehouse selector and management dialog -> focused backend/component tests.

## Scope

- Keep automatic creation of the first `Kho chính / MAIN` warehouse for every new restaurant.
- Return every active warehouse in the selected restaurant.
- Restore the warehouse selector in the storage header.
- Show the current warehouse count and provide create/edit/delete management UI.
- Retire a deleted warehouse with `isActive: false` so historical stock movements keep their warehouse reference.
- Prevent retiring the final active warehouse or a warehouse with non-zero on-hand/reserved stock.
- Validate that transfer source and destination are different active warehouses in the same restaurant.
- Transfer only available stock (`onHand - reserved`).
- Reuse existing permissions and GraphQL mutations; add no dependency.

## Acceptance criteria

- A newly created restaurant still starts with exactly one warehouse.
- A restaurant can create and manage additional warehouses from the manager inventory page.
- The header can switch the active warehouse used by stock, supply and audit operations.
- The UI shows the current active warehouse count.
- Edit updates warehouse name, code and address.
- Delete removes the warehouse from active operations without destroying historical references.
- Delete is blocked for the final warehouse and for warehouses with non-zero stock.
- Transfers cannot target the same warehouse, a warehouse outside the restaurant, or reserved stock.
- Read-only users can view warehouses but cannot create, edit or delete them.

## Files

- `cohan-restaurant-backend/graphql/resolvers/inventory/warehouse.query.js`
- `cohan-restaurant-backend/graphql/resolvers/inventory/warehouse.mutation.js`
- `cohan-restaurant-backend/graphql/resolvers/inventory/stock.mutation.js`
- `cohan-restaurant-backend/tests/resolvers/inventory-restaurant-access.test.js`
- `cohan-restaurant-backend/tests/resolvers/warehouse-management-flow.test.js`
- `src/components/Dashboard_Manager/Storage/graphql/warehouse.gql.js`
- `src/components/Dashboard_Manager/Storage/layout/Header/Header.jsx`
- `src/components/Dashboard_Manager/Storage/components/warehouses/WarehouseManagementDialog.jsx`
- `src/components/Dashboard_Manager/Storage/components/warehouses/WarehouseManagementDialog.scss`
- `src/components/Dashboard_Manager/Storage/components/warehouses/WarehouseManagementDialog.test.jsx`
- `src/components/Dashboard_Manager/Storage/StorageManagement.test.jsx`

## Out of scope

- Cross-restaurant stock transfer.
- Selecting a formal “primary warehouse” beyond the existing first-created default.
- Restoring retired warehouses from the UI.
- Batch transfer UI for multiple ingredients at once.

## Validation plan

- Focused inventory resolver Vitest.
- Focused warehouse-management component Vitest.
- GraphQL operation check.
- Conflict check and production build when a runnable checkout is available.
