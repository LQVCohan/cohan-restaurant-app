# Implementation plan

1. Preserve all Apollo hooks, mutations, variables, and inventory calculations.
2. Restructure the tab into overview, count, stock, and operations sections.
3. Add explicit labels and stable columns for responsive tables and movement history.
4. Replace the status select with accessible filter buttons while preserving the same `stockFilter` values.
5. Rebuild the scoped SCSS and remove the old visual rules instead of layering another override.
6. Review the final diff for desktop/mobile states, duplicate styling, and contract drift.

## Completed

- Rebuilt the inventory audit screen as an operations workspace with stable section hierarchy.
- Kept the existing queries, mutations, variables, permission boundary, and count-closing confirmation.
- Added clear success/error feedback, refresh, count progress, accessible filters, semantic tables, and mobile card layouts.
- Reviewed the final JSX/SCSS diff for duplicated styles and GraphQL contract drift.

## Validation status

- Static diff review: completed.
- Component tests, build, browser screenshots, and 390x844 / 430x932 device checks: not run because this GitHub connector does not provide the project runtime or browser environment.
