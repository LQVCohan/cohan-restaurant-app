# Unify manager page canvas

## Current behavior

The manager shell already supplies one sage background across the workspace. Several route components still render their own warm cream gradient on the root page container. On the customer page this is `.cm-page`; other manager pages use equivalent root containers. The result is a large cream rectangle inside the sage workspace.

## Root cause and flow

Visual flow:

`AppRouter -> ManagerLayout -> manager-page-shell -> manager-page-shell__body -> route component root -> page cards and controls`.

`ManagerUnifiedBackground.css` owns the shared manager canvas, but route-local styles loaded with each component can assign a later `background` to the direct page root. Fixing each page separately would duplicate the same override and leave future routes exposed.

This is a CSS-only issue. Schema, resolvers, GraphQL operations, Apollo state, permissions, realtime events, and UI actions are not involved.

## Scope

- Make the direct root element rendered inside `manager-page-shell__body` transparent for every manager route.
- Keep the shared sage background visible continuously across the content area.
- Preserve nested cards, headers, command bars, tables, filters, modals, semantic states, spacing, and responsive behavior.
- Reuse the existing shared manager background stylesheet; do not add a new override file.

## Files changing

- `src/layouts/ManagerUnifiedBackground.css`: add one shared layout-boundary rule for manager route roots.

## Acceptance criteria

1. The customer page no longer shows the large cream page canvas.
2. Dashboard, menu, inventory, staff, customer, analytics, finance, settings, AI, and other manager routes inherit the same sage workspace background.
3. Cards, toolbars, tables, empty states, and modals keep their existing surfaces.
4. Dark mode remains controlled by its existing dark-mode selectors.
5. No backend, GraphQL, permission, data, navigation, or UI-action changes.

## Out of scope

- Redesigning individual cards or page layouts.
- Removing card backgrounds.
- Changing header/sidebar styling.
- Adding dependencies, abstractions, or a new CSS patch file.

## Validation plan

- Re-fetch the shared stylesheet immediately before writing.
- Review selector scope against `ManagerLayout.jsx` and representative page roots.
- Review the commit diff for unintended surface removal.
- Run the narrowest available frontend build or browser smoke test when an executable environment is available.
