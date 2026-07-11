# Polish analytics occupancy and staff widgets

## Current behavior and root cause

- `SmartOccupancyHeatmap` builds a variable list of hour labels but its SCSS always reserves seven hour columns. With one or a few hour buckets, weekday labels and cells flow into the wrong columns and a fake horizontal scrollbar appears.
- Heatmap values are communicated mainly by background opacity and a hover-only tooltip, so the data is unclear on touch and keyboard devices.
- `StaffPerformance` renders three filter tabs even when the staff list is empty, creating controls that cannot change the result. A valid filter with no matching staff also renders a blank body.
- Both widgets retain large legacy SCSS blocks for elements that the current JSX no longer renders, making sizing and empty-state behavior difficult to reason about.

## End-to-end flow

`Order/Staff/analytics services` -> `analytics.ManagerDashboard occupancyHeatmap/staffPerformance resolvers` -> `managerDashboard GraphQL fields` -> `useAnalyst` -> `ManagerAnalyst` -> `SmartOccupancyHeatmap` and `StaffPerformance`.

The data contract is already repaired and remains unchanged. This task changes presentation only.

## Acceptance criteria

1. Heatmap columns match the actual number of distinct hour labels.
2. A one-hour heatmap displays one hour column with T2–CN as separate rows and no unnecessary horizontal overflow.
3. Every populated heatmap cell exposes a readable percentage without requiring hover; keyboard users can focus cells.
4. The heatmap keeps a compact loading and no-data state with a clear route to orders.
5. Staff filters are hidden when no staff data exists.
6. Selecting a filter with no matching employees shows a meaningful filtered-empty state instead of a blank panel.
7. Efficiency widths are clamped to 0–100 and filters expose pressed state.
8. Styling reuses manager analytics tokens, remains responsive and adds no dependency.

## Out of scope

- Changing occupancy, staffing or efficiency calculations.
- Changing GraphQL schema, resolver registration, permissions or restaurant scoping.
- Redesigning unrelated analytics sections.

## Validation plan

- `npx vitest run src/components/Dashboard_Manager/Analyst/components/AnalystQualityWidgets.test.jsx`
- `npm run build`
- Browser review at 375, 768, 1024 and 1440 px.
