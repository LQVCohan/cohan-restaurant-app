# Align menu stock with the fulfillment warehouse

## Current behavior

The manager menu card can show a positive number such as `Còn 100 suất`, while the customer food detail reports `Hết nguyên liệu` and `Món hiện chưa khả dụng` for the same item and serving variant.

## Root cause

`MenuItem.inventoryStatus` and `MenuItem.maxAvailable` are resolved through `menuItemInventoryAvailability.service`, which aggregates matching ingredient stock across every warehouse in the restaurant.

`menuItemLiveState` and `addCartItem` both select the first active warehouse and use only that warehouse for availability checks and reservations. Stock held in another warehouse therefore inflates the manager card but cannot be ordered by the customer flow.

## Flow traced

`MenuItem + Recipe + Ingredient + StockItem + Warehouse` → `menuItemInventoryAvailability.service` → `MenuItem.inventoryStatus/maxAvailable` → manager menu card and customer catalog badge → `menuItemLiveState` → food-detail quantity controls → `addCartItem` reservation.

## Scope

- Resolve the first active warehouse using the same filter and sort as the customer live-state and cart mutation paths.
- Restrict the menu-item availability aggregation to that warehouse.
- Keep the current ingredient formula, reservation flow, GraphQL schema and UI unchanged.
- Add a focused regression test that fails when the warehouse filter is absent.

## Acceptance criteria

- Manager `maxAvailable` and customer live `maxAvailableQty` are based on the same fulfillment warehouse.
- Stock in another warehouse does not make an item appear orderable when the fulfillment warehouse is empty.
- The first active warehouse is selected deterministically by `createdAt`, then `_id`.
- Missing active warehouse returns the existing safe `ERROR` availability result.
- No schema, migration, UI workaround, dependency or inventory formula change is introduced.

## Validation

```bash
cd cohan-restaurant-backend
npx vitest run tests/services/menu-item-inventory-warehouse-scope.test.js
npm run lint --if-present
npm run build --if-present
```
