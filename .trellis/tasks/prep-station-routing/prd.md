# Preparation Station Routing

## Current behavior and root cause

Orders and print jobs inferred `kitchen` or `bar` from item/category names. The KDS service and print flow used different keyword rules, so the same item could be routed differently. `MenuItem.printStationId` is exposed but is not backed by a usable `PrintStation` model or persisted consistently.

## End-to-end flow

`MenuItem.prepStation` -> backend order hydration -> immutable `OrderItem.prepStation` transaction snapshot -> immutable `KitchenOrderWorkItem.station` operational snapshot -> KDS and confirmed-order print grouping.

The three fields are not interchangeable:

- `MenuItem.prepStation` is current menu configuration for future orders.
- `OrderItem.prepStation` records the configuration used by that transaction, including orders that wait for transfer-payment verification before entering production.
- `KitchenOrderWorkItem.station` records the station that accepted the production work and is preserved during later status changes.

## Scope

- Add required `prepStation` configuration to menu items with `kitchen` and `bar` values.
- Snapshot station from the persisted menu item during backend order hydration; checkout clients cannot supply it.
- Create new kitchen work items from the order-item snapshot.
- Preserve the existing work-item station during later status changes.
- Group confirmed-order print jobs from the kitchen work-item snapshot.
- Add a per-item station control to menu management.
- Preserve station when copying a menu.
- Replace keyword-routing tests with configured-station and snapshot-preservation tests.
- Add deterministic dry-run migrations for existing menu items and active order items.

## Constraints

- Do not add station configuration to categories.
- Do not accept station from checkout clients.
- Do not use `printStationId` as a preparation-station substitute.
- Do not keep name/category keyword routing at runtime.
- Existing work items keep their stored station during later status changes.
- Preserve existing permissions, audit logging, restaurant scoping, realtime behavior, and GraphQL contracts.
- Current combos remain one parent order line and therefore one station; splitting mixed-station combo children is outside this task.

## Acceptance criteria

1. Two menu items in the same category can route to different stations.
2. A new order item snapshots the persisted menu item's configured station.
3. A new kitchen work item uses the order-item snapshot.
4. KDS and confirmed-order print jobs use the same work-item station.
5. Editing a menu item's station does not move an existing order item or work item.
6. Missing station data fails clearly instead of silently guessing.
7. The menu manager can create and edit the station value.
8. Existing menu items and active orders can be backfilled without classifying by category or item-name keywords.

## Files changed

- `cohan-restaurant-backend/models/menuitem.model.js`
- `cohan-restaurant-backend/models/order.model.js`
- `cohan-restaurant-backend/graphql/schema/menu.graphql`
- `cohan-restaurant-backend/graphql/resolvers/menu/mutation.js`
- `cohan-restaurant-backend/graphql/resolvers/menu/copyMutation.js`
- `cohan-restaurant-backend/src/services/orderItemHydration.service.js`
- `cohan-restaurant-backend/src/services/kitchen/kitchenOrderWorkItem.service.js`
- `cohan-restaurant-backend/graphql/resolvers/order/confirmedOrderPrintMutation.js`
- `cohan-restaurant-backend/graphql/resolvers/order/accessGuard.js`
- `src/hooks/useMenuManagement.js`
- `src/components/Dashboard_Manager/Menu/components/MenuItemCard/MenuItemCard.jsx`
- `src/components/Dashboard_Manager/Menu/components/MenuItemCard/PrepStationControl.jsx`
- `src/components/Dashboard_Manager/Menu/components/MenuItemCard/PrepStationControl.module.scss`
- `cohan-restaurant-backend/scripts/migrations/20260705-set-prep-station.js`
- `cohan-restaurant-backend/scripts/migrations/20260705-backfill-order-item-prep-station.js`
- targeted tests

## Out of scope

- Category-level defaults.
- Manual station reassignment after an item enters production.
- A new print-station management model.
- Splitting one combo into multiple station work items.
- Migration of completed historical orders.
