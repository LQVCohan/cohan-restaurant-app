# Preparation Station Routing

## Current behavior and root cause

Orders and print jobs infer `kitchen` or `bar` from item/category names. The KDS service and print flow use different keyword rules, so the same item can be routed differently. `MenuItem.printStationId` is exposed but is not backed by a usable `PrintStation` model or persisted consistently.

## End-to-end flow

`MenuItem.prepStation` -> kitchen work-item creation -> immutable `KitchenOrderWorkItem.station` snapshot -> KDS and confirmed-order print grouping -> manager menu item form.

`OrderItem` does not receive another station field because the existing kitchen work item is already the durable operational snapshot and is the source currently merged into `OrderItem.station` for GraphQL clients.

## Scope

- Add required `prepStation` configuration to menu items with `kitchen` and `bar` values.
- Resolve the station from the persisted menu item only when a kitchen work item is first created.
- Preserve the existing work-item station during later status changes.
- Group confirmed-order print jobs from the kitchen work-item snapshot.
- Add the station selector to the existing menu item modal.
- Preserve station when copying a menu.
- Replace keyword-routing tests with configured-station and snapshot-preservation tests.
- Add a deterministic backfill script for existing menu items.

## Constraints

- Do not add station configuration to categories.
- Do not accept station from checkout clients.
- Do not add a duplicate station snapshot to `OrderItem` while `KitchenOrderWorkItem` already serves that role.
- Do not use `printStationId` as a preparation-station substitute.
- Do not keep name/category keyword routing at runtime.
- Existing work items keep their stored station during later status changes.
- Preserve existing permissions, audit logging, restaurant scoping, realtime behavior, and GraphQL contracts.

## Acceptance criteria

1. Two menu items in the same category can route to different stations.
2. A new kitchen work item snapshots the menu item's configured `prepStation`.
3. KDS and confirmed-order print jobs use the same work-item station.
4. Editing a menu item's station does not move an existing work item.
5. Missing station data fails clearly instead of silently guessing.
6. The menu manager can create and edit the station value.
7. Existing menu items can be backfilled without classifying by category or item-name keywords.

## Files expected to change

- `cohan-restaurant-backend/models/menuitem.model.js`
- `cohan-restaurant-backend/graphql/schema/menu.graphql`
- `cohan-restaurant-backend/graphql/resolvers/menu/mutation.js`
- `cohan-restaurant-backend/graphql/resolvers/menu/copyMutation.js`
- `cohan-restaurant-backend/src/services/kitchen/kitchenOrderWorkItem.service.js`
- `cohan-restaurant-backend/graphql/resolvers/order/mutation.js`
- `src/hooks/useMenuManagement.js`
- `src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx`
- `cohan-restaurant-backend/scripts/backfill-menu-item-prep-station.js`
- targeted tests

## Out of scope

- Category-level defaults.
- Manual station reassignment after an item enters production.
- A new print-station management model.
- Migration of completed historical orders.
