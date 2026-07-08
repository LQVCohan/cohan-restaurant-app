# Homepage featured dishes by meal period

## Current behavior

The desktop customer homepage calculates the current `TimeSlot`, passes it to `DishGrid`, and `DishGrid` sends it to the `topMenuItems` GraphQL query. The resolver resolves active `Menu` records for that time slot and limits `MenuItem` results to those menu ids.

## Root cause / gap

The requested runtime behavior is already present on `main`. The remaining gap is regression coverage: the resolver test only checks that `topMenuItems` is public and does not prove that a requested time slot constrains the featured dish query.

## End-to-end flow checked

1. `cohan-restaurant-backend/models/menu.model.js` stores one menu per restaurant and time slot.
2. `cohan-restaurant-backend/models/menuitem.model.js` links each dish to a `menuId`.
3. `cohan-restaurant-backend/graphql/schema/menu.graphql` exposes the optional `timeSlot` argument on `topMenuItems`.
4. `cohan-restaurant-backend/graphql/resolvers/menu/query.js` resolves active menu ids for the requested time slot and applies them to the `MenuItem` query.
5. `src/components/Customer/Homepage_Client/components/DishGrid.jsx` sends `timeSlot` in the Apollo operation.
6. `src/components/Customer/Homepage_Client/Home.jsx` supplies the current meal period to `DishGrid`.

## Scope

- Add one resolver regression test proving that featured dishes are constrained to active menus for the requested time slot.
- Keep the existing GraphQL contract and runtime implementation unchanged.
- Change the fewest files.

## Acceptance criteria

- Calling `topMenuItems` with `timeSlot: lunch` queries active lunch menus only.
- The resulting `MenuItem` query includes only the ids of those lunch menus.
- Public restaurant/orderability filtering remains in place.
- No duplicate frontend or backend filter is introduced.

## Out of scope

- Changing meal-period boundaries.
- Homepage redesign or copy changes.
- Changing menu data or seed data.
- Adding dependencies.

## Validation plan

- Run the targeted Vitest resolver test for `menu-restaurant-access.test.js` when a runnable checkout is available.
- Review the final diff for contract drift and unrelated changes.
