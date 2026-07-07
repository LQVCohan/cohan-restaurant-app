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
- Replace the mixed visible emoji treatment with consistent lightweight CSS glyphs and status dots.
- Turn the four oversized cards into a compact grouped KPI strip with subtle dividers.
- Align each label and value on one row and keep numeric typography tabular.
- Preserve the existing two-column mobile fallback.

## Files changed

- `src/components/Dashboard_Manager/Table/TableManagementHeaderStatsPolish.scss`: table-page-only KPI layout and icon treatment.
- `src/main.jsx`: load the override after the existing table-management polish layers.
- Task artifacts in this directory.

## Deliberate minimalism

The existing JSX, shared `ManagementPageHeader`, GraphQL query, resolver, and calculations remain unchanged. The issue is presentational, so a scoped final SCSS layer is the smallest safe fix and avoids affecting other manager pages that reuse the shared header.

## Out of scope

- Schema, resolver, Apollo query, table status rules, filters, controls, or other manager headers.

## Validation

- Re-fetched and reviewed the final SCSS and import order.
- Confirmed the selector is scoped under `.tm-container` and cannot alter unrelated manager headers.
- A focused component test, production build, and browser screenshot comparison could not be run in the connected environment.
