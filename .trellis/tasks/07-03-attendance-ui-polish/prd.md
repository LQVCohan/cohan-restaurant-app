# Unify manager UI with a light sage palette

## Current behavior

The manager workspace mixes two competing visual systems:

- light sage green on newer operational pages;
- beige/cream backgrounds, borders and shadows in the manager shell, sidebar and legacy staff/HR surfaces.

The attendance page also contains several layout defects: a double-bordered employee search, a nested-looking reconciliation card, a cramped quick attendance form, a misleading `-- •` empty score and excessive empty-table height.

## Root cause and flow

The business flow remains unchanged:

`schema/model -> resolver/service/guard -> GraphQL operation/Apollo hook -> manager page action -> tests`.

The palette inconsistency is at the shared frontend boundary:

- `ManagerUnifiedBackground.css` defined the shared canvas with beige tokens and excluded the order page;
- manager shell and sidebar component styles also contain cream and brown values;
- legacy page styles load their own cream variables and global classes;
- attendance-specific final CSS retained several cream values.

## Implementation

Use the existing manager layout boundary rather than editing every page separately:

- make `ManagerUnifiedBackground.css` the shared sage token source for every manager page, including orders;
- apply sage canvas, header, sidebar, scope selector, neutral cards, forms, tables, modals and empty states;
- add one scoped compatibility layer for legacy HR/staff and other common surface classes;
- keep warning, danger and success colors distinct so status meaning is not lost;
- update the attendance repair layer to consume the shared manager tokens;
- preserve native controls, focus rings, responsive behavior, routing, permissions and data operations.

## Files

- `src/layouts/ManagerUnifiedBackground.css`
- `src/layouts/ManagerSageSurfaceOverrides.css`
- `src/styles/AttendanceManagerVisualFix.css`
- `src/main.jsx`

## Acceptance criteria

- All `/manager` pages share a light sage canvas and neutral sage-tinted surfaces.
- Header, sidebar, branch selector, cards, inputs, tables and neutral modals no longer use beige as the primary palette.
- Warning, error, danger and success states remain visually distinguishable.
- Staff/HR legacy pages consume the same sage variables without component rewrites.
- Attendance search, quick action, reconciliation and empty-table fixes remain intact.
- No GraphQL, resolver, permission, routing or mutation behavior changes.

## Validation

- Frontend conflict check, lint, component/unit tests and build in CI.
- Existing manager attendance Playwright smoke path.
- Manual visual review across representative manager pages and narrow breakpoints when a browser runtime is available.

## Out of scope

- Rewriting page components or introducing a new design system.
- Changing attendance, payroll, order, table, customer or finance behavior.
- Recoloring semantic warning, danger and success states into sage.
- Adding dependencies.
