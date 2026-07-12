# Selected manager menu flow

## Current behavior and root cause

The backend already supports multiple menus in one service time slot and accepts an exact `menuId` for manager item queries and mutations. The manager page still relies on `managerMenuSelectionLink` to inject the selected menu from session storage after the Apollo operation is created. This leaves the hook cache variables scoped only by `timeSlot`, so sibling menus share one frontend query identity.

The page also keeps two menu CRUD implementations: `MenuManagement.jsx` owns the full `MenuModal`, while `CompactMenuStrip.jsx` owns a second editor and its own GraphQL mutations. The parent implementation still contains one-menu-per-slot guards, so the two flows disagree.

## End-to-end flow

`Menu.id` -> selected menu state in `MenuManagement` -> `useMenuManagement(menuId)` -> explicit GraphQL filter/input -> multi-slot resolver -> `MenuItem.menuId`.

Menu CRUD uses one path only:

`CompactMenuStrip action` -> parent callback -> `MenuModal` / confirmation -> `useMenuManagement` mutation.

## Scope

1. Lift the exact selected menu id to the manager page and keep it valid when restaurant, slot or menu data changes.
2. Pass `menuId` explicitly to item connection queries, item creation, inventory sync and bulk price updates.
3. Pass the exact menu id into the item modal.
4. Remove duplicate mutations and inline editor/delete confirmation from `CompactMenuStrip`; keep it as the grouped menu chooser and action launcher.
5. Remove one-menu-per-slot create/copy guards and include `id` for edit/toggle operations.
6. Preserve permissions, restaurant scope, audit behavior, customer time-slot aggregation and existing visual styling.

## Acceptance criteria

1. Selecting two sibling menus in the same time slot produces distinct Apollo variables and distinct item lists.
2. Creating a dish attaches it to the selected `menuId`.
3. Inventory sync and bulk price operations include the selected `menuId`.
4. Create and copy allow a target time slot that already contains another menu.
5. Edit and visibility toggle update only the selected menu id.
6. There is one menu create/edit/copy/delete UI flow.
7. Grouped menu list, loading/error states, permissions and responsive layout remain intact.

## Out of scope

- Customer-facing menu selection or VIP entitlement rules.
- Moving existing dishes between menus.
- Backend schema/resolver redesign; current multi-slot contract is retained.
- New dependencies or a visual redesign.

## Validation plan

- `npx vitest run src/apollo/managerMenuSelectionLink.test.js src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx`
- Add a focused hook/manager regression test if an existing test seam supports it without new scaffolding.
- `npm run check:graphql`
- `npm run build`
- Manual review at 390x844, 768px and 1440px when a browser runtime is available.
