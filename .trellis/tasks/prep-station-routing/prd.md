# Preparation Station Routing

## Current behavior and root cause

Orders and print jobs inferred `kitchen` or `bar` from item/category names. The KDS service and print flow used different keyword rules, so the same item could be routed differently. `MenuItem.printStationId` is exposed but is not backed by a usable `PrintStation` model or persisted consistently.

The shared staff dispatch page now has explicit kitchen and bar modes, but its UI still behaves like a generic card grid: operational priority is weak, all summary cards have equal weight, loading/error/empty states are passive, touch targets are small, and mobile mode controls consume too much vertical space. These are presentation and interaction problems; the station contract and status mutation path are already correct.

## End-to-end flow

`MenuItem.prepStation` -> backend order hydration -> immutable `OrderItem.prepStation` transaction snapshot -> immutable `KitchenOrderWorkItem.station` operational snapshot -> `ordersByRestaurantNow` -> `useOrderManagement` -> shared staff dispatch UI -> `updateOrderItemStatus`.

The three persisted fields are not interchangeable:

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
- Present kitchen and bar as explicit modes in the same staff dispatch workspace.
- Open bartender accounts directly in bar mode and grant the existing item-status permissions required by that workflow.
- Redesign the shared dispatch workspace for fast scanning: live station counts, asymmetric priority summary, urgent-first ordering, clear station identity, and large station-specific actions.
- Add useful skeleton, retry, and empty states without changing the GraphQL contract.
- Keep controls usable at 390×844 and 430×932, with keyboard focus and reduced-motion support.

## Visual direction

Use the existing staff workspace palette and typography rhythm: warm neutral surfaces, emerald for kitchen, restrained sky blue for bar, and red only for overdue work. The screen's main job is to let a kitchen or bar worker identify the next item and act with one obvious tap. The signature detail is a station switcher that exposes live queue counts before the user changes mode.

## Constraints

- Do not add station configuration to categories.
- Do not accept station from checkout clients.
- Do not use `printStationId` as a preparation-station substitute.
- Do not keep name/category keyword routing at runtime.
- Existing work items keep their stored station during later status changes.
- Preserve existing permissions, audit logging, restaurant scoping, realtime behavior, and GraphQL contracts.
- Current combos remain one parent order line and therefore one station; splitting mixed-station combo children is outside this task.
- Reuse `/staff/kitchen`; do not create a duplicate bar page or duplicate order-fetching flow.
- Do not add UI dependencies or replace the React/SCSS stack.
- Do not use CSS zoom or fixed controls that cover content on mobile.

## Acceptance criteria

1. Two menu items in the same category can route to different stations.
2. A new order item snapshots the persisted menu item's configured station.
3. A new kitchen work item uses the order-item snapshot.
4. KDS and confirmed-order print jobs use the same work-item station.
5. Editing a menu item's station does not move an existing order item or work item.
6. Missing station data fails clearly instead of silently guessing.
7. The menu manager can create and edit the station value.
8. Existing menu items and active orders can be backfilled without classifying by category or item-name keywords.
9. Managers can switch between kitchen, bar, and combined modes in the same workspace and see each queue count before switching.
10. Bartenders enter directly in bar mode, see only bar work, and can update bar item status.
11. Overdue or unaccepted work appears before normal work within the selected mode.
12. Loading uses layout-shaped skeletons; errors provide retry; empty filtered states provide a useful reset action.
13. Primary actions have at least a 44px mobile touch target and visible keyboard focus.
14. The layout remains usable at 390×844 and 430×932 without horizontal page overflow or covered content.

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
- `cohan-restaurant-backend/scripts/seedRoles.js`
- `src/hooks/useMenuManagement.js`
- `src/utils/frontendRoleAccess.js`
- `src/layouts/StaffLayout.jsx`
- `src/components/Staff/StaffKitchenPage.jsx`
- `src/components/Staff/StaffKitchenPage.scss`
- `src/components/Staff/StaffKitchenPage.test.jsx`
- `src/components/Dashboard_Manager/Menu/components/MenuItemCard/MenuItemCard.jsx`
- `src/components/Dashboard_Manager/Menu/components/MenuItemCard/PrepStationControl.jsx`
- `src/components/Dashboard_Manager/Menu/components/MenuItemCard/PrepStationControl.module.scss`
- `cohan-restaurant-backend/scripts/migrations/20260705-set-prep-station.js`
- `cohan-restaurant-backend/scripts/migrations/20260705-backfill-order-item-prep-station.js`
- targeted tests

## Validation plan

- `npx vitest run src/components/Staff/StaffKitchenPage.test.jsx`
- `npm run check:staff-theme`
- `npm run build`
- Manual responsive review at 390×844 and 430×932 when a browser environment is available.

## Out of scope

- Category-level defaults.
- Manual station reassignment after an item enters production.
- A new print-station management model.
- Splitting one combo into multiple station work items.
- Migration of completed historical orders.
- Station-specific backend permissions beyond the existing restaurant-scoped order update permission.
- A separate route or duplicated data flow for the bar.
