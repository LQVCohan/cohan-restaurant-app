# Reorganize staff header navigation

## Current behavior and root cause

`StaffLayout` places the page heading and account controls in one row, then renders three navigation groups as a three-column grid. On wide screens the work links wrap independently from account and support links, leaving uneven columns and empty space. Group labels sit above separate pill cards, so the header reads as several unrelated button clusters. The role workspace link also keeps a soft-green treatment when another page is active, producing two active-looking destinations.

## End-to-end flow

`AppRouter` -> `StaffLayout` -> route-derived `staffPageMeta` -> role/permission-filtered `navItems` -> grouped staff navigation -> current route active state.

No schema, resolver, Apollo operation, restaurant scope, role/permission rule, notification behavior, messenger behavior or page content needs to change.

## Direction

Compact two-tier operations header: page context and account controls on top, then one unified navigation surface with a full-width work row and a secondary account/support row. Only the current route receives the strong active treatment.

## Scope

- Reuse the existing `StaffLayout` markup, visible items, permission checks, role checks and role-workspace-first ordering.
- Add one scoped presentation override following the repository's existing `*Polish/*Override` pattern.
- Rebuild the desktop navigation layout into aligned labeled rows without duplicating navigation code.
- Reduce individual card styling and use one shared navigation surface.
- Keep the notification bell, identity card, mobile menu and messenger behavior intact.
- Load the scoped override after component styles from `src/main.jsx`.

## Acceptance criteria

1. The header keeps page context on the left and account controls aligned on the right.
2. Work navigation is presented as the primary full-width row.
3. Account and support navigation share a clean secondary row without floating empty columns.
4. Only the current route uses the filled green active state.
5. The role workspace remains first in the visible navigation without looking active on unrelated pages.
6. Mobile menu remains keyboard accessible, grouped and usable at 390x844 and 430x932.
7. Route, permission, notification and messenger behavior remain unchanged.

## Files changed

- `src/styles/StaffHeaderProfessional.css`
- `src/main.jsx`

## Out of scope

- Changing route metadata copy or page-specific content.
- Changing role/permission definitions or route guards.
- Adding icons, dependencies, a sidebar or a second navigation implementation.
- Redesigning NotificationBell or ContactsView.

## Validation plan

- `npx vitest run src/layouts/StaffLayout.test.jsx`
- `npm run check:staff-theme`
- `npm run build`
- Manual review at 390x844, 430x932, 768px, 1024px and 1440px when a browser runtime is available.
