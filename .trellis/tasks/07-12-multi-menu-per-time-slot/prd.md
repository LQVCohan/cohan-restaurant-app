# Multiple menus per restaurant time slot

## Current behavior and root cause

The restaurant has four service time slots (`breakfast`, `lunch`, `dinner`, `late_night`), but the current system treats a time slot as the menu identity:

- MongoDB has a unique index on `(restaurantId, timeSlot)`.
- Menu create/update, copy, item creation, inventory sync and recipe listing resolve one menu with `findOne({ restaurantId, timeSlot })`.
- GraphQL item filters do not accept `menuId`.
- The manager UI stores only `selectedTimeSlot` and collapses menus into `Map<timeSlot, menu>`.

This caps a restaurant at four menus and makes legitimate same-slot menus such as VIP, formal dining, casual dining or late-night snacks impossible.

## Domain decision

- A restaurant still has four fixed service time slots.
- A time slot may contain any number of named menus.
- `Menu.id` is the menu identity; `timeSlot` is only a service-window classification.
- `MenuItem.menuId` remains the ownership boundary for dishes and recipes.
- Exact management operations use `menuId`.
- Legacy/public time-slot-only queries aggregate all active menus in that slot so existing callers do not lose items.

## End-to-end flow

`Menu restaurantId + timeSlot (non-unique)` -> menu/query/mutation/category/inventory/recipe resolvers -> GraphQL `menuId` selectors -> `useMenuManagement` / `useRecipes` -> manager selected menu -> item create/edit/sync/copy -> customer menu selection -> exact menu items.

## Scope

1. Replace the unique slot index with a normal lookup index and provide an idempotent migration script for deployed databases.
2. Update menu create/edit so new menus create new documents and edits target an exact menu id.
3. Permit copy into the same or an already-used time slot.
4. Add optional `menuId` to menu item, category, inventory and recipe query inputs while retaining time-slot compatibility.
5. Require exact menu selection when creating an item if a slot contains multiple menus.
6. Track `selectedMenuId` in the manager hook and pass it through item, recipe and inventory operations.
7. Render all menus grouped under the four time slots instead of collapsing one menu per slot.
8. Allow creation regardless of whether all four slots already contain menus.
9. Let the main customer menu screen choose among active menus in the selected time slot.
10. Preserve restaurant permissions, audit logs, item statuses, recipes, inventory behavior and existing four-slot labels.

## Acceptance criteria

1. A restaurant can create two or more menus with the same `timeSlot` and different names.
2. Editing, hiding, deleting, copying or syncing one menu never targets a sibling menu in the same slot.
3. Adding a dish attaches it to the manager-selected `menuId`.
4. Manager list shows every menu grouped by breakfast, lunch, dinner and late night.
5. Copying a menu can target the same slot or any occupied slot.
6. Public/customer queries never expose inactive menus.
7. Customer MenuDetailView displays a menu selector when the chosen slot has multiple active menus and loads only the selected menu's categories/items.
8. Existing callers that only pass `timeSlot` continue to receive items from all active menus in that slot.
9. Migration check identifies the legacy unique index; apply mode drops it and creates the new lookup index safely.
10. Targeted tests cover same-slot creation/query routing and ambiguous item creation.

## Out of scope

- VIP entitlement, table package, reservation tier or price-access restrictions. Those require a separate visibility/audience policy.
- Changing the four fixed time-slot enum values.
- Moving dishes between menus after creation.
- New dependencies or a new menu-management framework.

## Validation plan

- `cd cohan-restaurant-backend && npx vitest run tests/resolvers/menu-multi-slot.test.js tests/resolvers/menu-restaurant-access.test.js`
- `npm run check:graphql`
- `npm run build`
- `cd cohan-restaurant-backend && npm run migrate:menu-multi-slot:check`
- Manual manager/customer review at 390x844, 768px and 1440px when a browser runtime is available.
