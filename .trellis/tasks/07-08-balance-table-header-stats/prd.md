# Balance table header statistics

## Current behavior

The table-management header stretches four independent KPI cards across the available middle column. Each card keeps a small icon and two short text lines pinned to the left, leaving a large empty area. Platform emoji also mix pictograms with red/green circle emoji, so the visual weight is inconsistent.

## Root cause

`ManagementPageHeader` is intentionally generic. The table page adds another compact override in `TableManagementScorePolish.scss`, but it still preserves the generic four-card composition. The layout therefore scales the card surfaces instead of the information density.

## Data flow

1. `Table.status`, `floorId`, and related fields are defined by the table GraphQL schema.
2. The `tables` resolver validates restaurant access and returns the table list.
3. `useTableManagement` queries the list with Apollo.
4. `TableManagement` maps the result and calculates total, occupied, available, and floor counts.
5. `ManagementPageHeader` renders those values; page-specific SCSS controls only their presentation.

## Scope

- Keep all four existing statistics and calculations.
- Replace mixed emoji with consistent lightweight glyphs plus tone classes.
- Turn the four oversized cards into a compact grouped KPI strip with subtle dividers.
- Keep number typography tabular and preserve readable labels.
- Preserve the existing two-column mobile fallback.

## Files to change

- `src/components/Dashboard_Manager/Table/TableManagement.jsx`
- `src/components/Dashboard_Manager/Table/TableManagementScorePolish.scss`
- Task artifacts in this directory.

## Out of scope

- Schema, resolver, Apollo query, table status rules, filters, controls, or other manager headers.

## Validation

- Review the final JSX and SCSS diff.
- Run the focused table-management component test and production build when a runnable workspace or CI is available.
- Compare desktop and narrow-screen screenshots when browser execution is available.
