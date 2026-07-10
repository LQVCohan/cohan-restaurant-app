# Inventory audit completion and legacy transfer safety

## Current behavior

The manager storage screen uses the restaurant's first active warehouse as its default scope. The inventory-count workflow exists, but the count table renders only the first 80 lines, document reconciliation is not scoped to the selected count period, and draft counts cannot be cancelled from the UI. Legacy restaurants with multiple warehouses can still open the supply transfer action, while the resolver performs several writes without one transaction and compares transfer quantity only with `onHand`.

## Root cause

The frontend count workflow and backend contract drifted: the UI truncates editable count lines and does not send the selected period to the document query. Warehouse ownership is not verified when creating a count. The legacy supply transfer path writes source stock, destination stock, batches, and movements independently.

## End-to-end flow

`InventoryCount/StockItem/StockMovement/Warehouse -> inventoryCount and supply resolvers -> inventoryCount/inventory GraphQL operations -> StorageManagement -> InventoryAuditTab/SupplyList/SupplyCard`.

## Scope

- Keep the single-default-warehouse manager experience unchanged.
- Paginate all inventory-count lines instead of truncating them.
- Scope reconciliation movements to the selected count period.
- Expose the existing cancel-count mutation in the draft-count UI.
- Verify that a count warehouse belongs to the selected restaurant.
- Make legacy supply transfer transactional and protect reserved stock.
- Show the supply transfer action only when at least two warehouses exist.
- Do not add ingredient transfer UI because the active product direction is one default warehouse per restaurant.

## Acceptance criteria

- Every inventory-count line is reachable and editable, including counts with more than 80 ingredients.
- Reconciliation movements use the active count's start and end dates.
- A manager can cancel a draft count and closed counts remain immutable.
- A count cannot be created for a warehouse outside the restaurant.
- Supply transfer either completes all stock/movement writes or rolls them back.
- Supply transfer cannot consume reserved quantity.
- Restaurants with one warehouse do not show an unusable transfer control.

## Files

- `cohan-restaurant-backend/graphql/resolvers/inventory/inventoryCount.js`
- `cohan-restaurant-backend/graphql/resolvers/supply/mutation.js`
- `src/components/Dashboard_Manager/Storage/graphql/inventoryAudit.gql.js`
- `src/components/Dashboard_Manager/Storage/components/inventory/InventoryAuditTab.jsx`
- `src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx`
- `src/components/Dashboard_Manager/Storage/components/supplies/SupplyCard.jsx`
- targeted tests when practical

## Validation plan

- Run focused inventory component and resolver tests.
- Run GraphQL operation validation and conflict check.
- Run the production build when a runnable checkout is available.
- Review the final diff for restaurant scope, permissions, duplicate writes, and single-warehouse UI regressions.
