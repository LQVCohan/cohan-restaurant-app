# Selected manager menu flow

## Current behavior and root cause

The backend already supports multiple menus in one service time slot. `menuMultiSlot.graphql` accepts an exact `menuId`, resolver overrides target that menu, and the manager Apollo link injects the selected menu into item creation, stock sync and bulk-price mutations.

The remaining gap is the active Apollo query. `CompactMenuStrip` changes session selection and calls a generic named-query refetch. The observable query still owns its old time-slot-only variables, so sibling menus can briefly reuse the same cache identity and selection changes are harder to reason about. The compact page header also shows only the total menu count, not the exact menu whose dishes are currently displayed.

A deeper caller check found that the inline `CompactMenuStrip` CRUD path already sends exact menu ids; the stale parent callbacks are not the selected-list execution path. Rewriting the large page is therefore unnecessary for this fix.

## End-to-end flow

`CompactMenuStrip select Menu.id` -> `manager:menu-selection` event -> `ManagerMenuSelectionSync` -> refetch active item/category queries with explicit `menuId` -> multi-slot resolver -> exact `MenuItem.menuId` list.

The existing mutation flow remains:

`managerMenuSelectionLink` -> exact `menuId` in create item, inventory sync and bulk price inputs.

## Scope

1. Refetch active manager item and category observable queries with explicit `menuId` variables when selection changes.
2. Skip unrelated restaurant/time-slot queries instead of refetching them.
3. Remove the duplicate generic item refetch from `CompactMenuStrip`.
4. Show the exact selected menu and service slot in the compact page summary.
5. Preserve current menu CRUD, permissions, restaurant scope, loading/error states and responsive styling.

## Acceptance criteria

1. Selecting two sibling menus in one time slot refetches `MenuItemsConnection` with different explicit `filter.menuId` values.
2. Category metrics refetch with the same selected `menuId`.
3. Queries for another restaurant or time slot are not touched.
4. The compact summary names the selected menu and its service slot.
5. Existing grouped list, create/edit/copy/delete, inventory sync and audit actions remain available.
6. No backend, dependency or unrelated page change is introduced.

## Out of scope

- Customer-facing menu selection or VIP entitlement rules.
- Moving existing dishes between menus.
- Backend schema/resolver redesign.
- Rewriting the full manager menu page or changing its visual system.

## Validation plan

- `npx vitest run src/apollo/ManagerMenuSelectionSync.test.jsx src/apollo/managerMenuSelectionLink.test.js src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx`
- `npm run check:graphql`
- `npm run build`
- Manual review at 390x844, 768px and 1440px when a browser runtime is available.
