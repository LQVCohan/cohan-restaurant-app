# Multiple menus per restaurant time slot

## Current behavior and root cause

The restaurant has four service time slots (`breakfast`, `lunch`, `dinner`, `late_night`), but the previous system treated a time slot as the menu identity:

- MongoDB had a unique index on `(restaurantId, timeSlot)`.
- Menu create/update, copy, item creation, inventory sync, bulk pricing and recipe listing resolved one menu with `findOne({ restaurantId, timeSlot })`.
- GraphQL item filters did not accept `menuId`.
- The manager UI stored only `selectedTimeSlot` and collapsed menus into `Map<timeSlot, menu>`.

This capped a restaurant at four menus and made legitimate same-slot menus such as VIP, formal dining, casual dining or late-night snacks impossible.

## Domain decision

- A restaurant still has four fixed service time slots.
- A time slot may contain any number of named menus.
- `Menu.id` is the menu identity; `timeSlot` is only a service-window classification.
- `MenuItem.menuId` remains the ownership boundary for dishes and recipes.
- Exact management operations use `menuId`.
- Legacy/public time-slot-only item and category queries aggregate all active menus in that slot so existing customer screens do not lose dishes.

## End-to-end flow

`Menu restaurantId + timeSlot (non-unique)` -> menu/category/inventory/recipe resolvers -> GraphQL `menuId` selectors -> Apollo manager-menu selection link -> grouped manager menu list -> exact item create/query, stock sync, bulk price, edit/copy/delete actions.

## Scope

1. Replace the unique slot index with a normal lookup index and provide an idempotent migration script for deployed databases.
2. Update menu create/edit so new menus create new documents and edits target an exact menu id.
3. Permit copy into the same or an already-used time slot.
4. Add optional `menuId` to menu-item query/create, stock-sync and bulk-price inputs while retaining time-slot compatibility.
5. Route manager item queries and actions to the selected menu without rewriting the existing menu-item page.
6. Aggregate same-slot menus for legacy public item/category queries and manager recipe listing.
7. Render all menus grouped under the four time slots instead of collapsing one menu per slot.
8. Allow creation regardless of whether all four slots already contain menus.
9. Preserve restaurant permissions, audit logs, item statuses, recipes, inventory behavior and existing four-slot labels.

## Acceptance criteria

1. A restaurant can create two or more menus with the same `timeSlot` and different names.
2. Editing, hiding, deleting, copying, stock syncing or bulk pricing one menu never targets a sibling menu in the same slot.
3. Adding a dish attaches it to the manager-selected `menuId`.
4. Manager list shows every menu grouped by breakfast, lunch, dinner and late night.
5. Copying a menu can target the same slot or any occupied slot.
6. Public/customer time-slot browsing never exposes inactive menus and still sees dishes/categories from every active menu in that slot.
7. Recipe listing does not omit dishes from the second or later menu in a slot.
8. Migration check identifies the legacy unique index; apply mode drops it and creates the new lookup index safely.
9. Targeted tests cover same-slot creation, exact query routing, manager operation injection and index migration.

## Out of scope

- VIP entitlement, table package, reservation tier or price-access restrictions. Those require a separate visibility/audience policy.
- A customer-facing menu chooser. Current customer compatibility intentionally aggregates all active menus in the chosen time slot.
- Changing the four fixed time-slot enum values.
- Moving existing dishes between menus.
- New dependencies or a new menu-management framework.

## Validation plan

- `cd cohan-restaurant-backend && npx vitest run tests/resolvers/menu-multi-slot.test.js tests/resolvers/menu-restaurant-access.test.js tests/resolvers/public-customer-permission-flows.test.js tests/resolvers/inventory-recipe-search.test.js tests/scripts/migrate-menu-multi-slot-indexes.test.js`
- `npx vitest run src/apollo/managerMenuSelectionLink.test.js`
- `npm run check:graphql`
- `npm run build`
- `cd cohan-restaurant-backend && npm run migrate:menu-multi-slot:check`
- Manual manager/customer review at 390x844, 768px and 1440px when a browser runtime is available.
