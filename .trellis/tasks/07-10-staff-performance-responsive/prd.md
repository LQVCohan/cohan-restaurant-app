# Staff performance responsive fix

## Current behavior and root cause

The manager staff performance page renders `StaffPerformancePage` inside the shared staff content container. `PerformanceDetailPanel` returns `null` until a row is selected, but `.performance-layout` always defines a second fixed 360px column. This leaves an empty column and compresses the table even though no detail panel exists.

The fallback at `@media (max-width: 1200px)` uses viewport width. The manager sidebar and page shell can make the available content area much narrower while the viewport is still wider than 1200px, so the layout remains in the broken two-column state.

## End-to-end flow

No data contract changes are required.

`StaffManagement` maps staff data and renders `StaffPerformancePage` -> the page loads performance data through the existing `useStaffPerformance` hook -> rows update local selection state -> `PerformanceDetailPanel` is rendered only for a selected employee -> SCSS controls table/detail placement.

## Scope

- Let the performance table use the full content width when no employee detail is open.
- Enable the table/detail split only when a detail panel is present.
- Base responsive stacking on the performance page container width, not only the browser viewport.
- Keep filters, KPIs, overview cards, table scrolling, selection, review, recalculation, export, permissions, and restaurant scoping unchanged.

## Files changed

- `src/components/Dashboard_Manager/Staff/components/Performance/index.js`: load the responsive override after the existing component stylesheet.
- `src/components/Dashboard_Manager/Staff/components/Performance/StaffPerformanceResponsive.scss`: fix the grid root cause and add container-width responsive behavior without rewriting the established stylesheet.

## Acceptance criteria

1. With no selected employee, the table card spans the complete available width and no empty 360px column remains.
2. Selecting a row opens the existing detail panel without changing its data or actions.
3. When the available page width is narrow, the detail panel stacks below the table even if the browser viewport is wide.
4. Filters and hero actions wrap cleanly without overlapping or forcing page-level horizontal overflow.
5. The table remains horizontally scrollable only inside its card at small widths.
6. Existing loading, empty, error, export, review, and recalculation behavior remains unchanged.

## Implementation result

- `.performance-layout` now defaults to one full-width column.
- The fixed detail column is enabled only when `.performance-detail-panel` is actually mounted.
- Named container queries stack the detail panel and adapt controls, KPI cards, overview cards, and table behavior to the real staff content width.
- No backend, GraphQL, state, permission, restaurant-scope, or performance-score logic changed.

## Validation plan

- `npm run check:conflicts`
- `npm run test:performance`
- `npm run build`
- Visual checks at container widths representative of 1440, 1024, 768, 430x932, and 390x844 when a browser environment is available.

## Validation result

The updated import order and SCSS selectors were reviewed through the latest GitHub file contents. Automated tests, Vite build, and browser viewport checks were not run because the connected GitHub environment does not provide a repository execution/browser session and no workflow run was created for the commit.

## Out of scope

- Backend/schema/resolver/service changes.
- Changes to the performance formula, scoring data, permissions, or restaurant access.
- Replacing the existing React/SCSS stack or adding dependencies.
