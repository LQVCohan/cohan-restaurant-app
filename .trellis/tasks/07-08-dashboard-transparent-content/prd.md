# Remove dashboard content shell background

## Current behavior

The manager workspace already provides one sage background across the sidebar, header, and scrollable content area. The dashboard still renders a separate warm gradient shell around all dashboard sections, producing a visible beige block with rounded top corners inside the page canvas.

## Root cause and flow

Visual flow:

`AppRouter -> ManagerLayout -> Dashboard/index.js -> DashboardSynchronized.jsx -> Dashboard.jsx -> Dashboard.scss -> DashboardPromotionTheme.scss`.

`Dashboard.scss` intentionally keeps `.manager-dashboard` transparent so `ManagerUnifiedBackground.css` can provide the page canvas. `DashboardPromotionTheme.scss` is imported later by `DashboardSynchronized.jsx` and overrides the same root selector with a warm gradient, rounded corners, and four-sided padding. The data flow and UI actions are correct; the mismatch is only in the final CSS cascade.

## Scope

- Remove the root-shell visual overrides from `DashboardPromotionTheme.scss`.
- Keep the shared manager canvas visible behind dashboard sections.
- Preserve all card surfaces, semantic states, responsive grids, data loading, permissions, GraphQL operations, realtime events, and navigation actions.

## Files changing

- `src/components/Dashboard_Manager/Dashboard/DashboardPromotionTheme.scss`: stop overriding the root dashboard canvas, radius, and layout padding.

## Acceptance criteria

1. The beige rounded content shell is no longer visible around the dashboard.
2. The dashboard uses the same sage page background as the surrounding manager workspace.
3. Dashboard cards, filters, headers, empty states, and semantic colors remain unchanged.
4. Desktop and mobile layout continue to use spacing defined by `Dashboard.scss`.
5. No backend, GraphQL, permission, data, or UI-action code changes.

## Out of scope

- Redesigning dashboard cards or typography.
- Changing the manager header or sidebar.
- Altering dashboard queries, realtime subscriptions, navigation, or business logic.
- Adding dependencies or new abstractions.

## Validation plan

- Re-fetch the target stylesheet immediately before editing.
- Review the import order and final selector ownership.
- Run the narrowest frontend build or browser smoke test when an executable environment is available.
