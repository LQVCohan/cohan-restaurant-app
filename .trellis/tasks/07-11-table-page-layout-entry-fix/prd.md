# Table page layout and settings entry fix

## Current behavior and root cause

- `TableManagementSettingsEntry` rendered a separate toolbar before the actual table page and offset it with a negative margin, so **Loại bàn & không gian** floated outside the page header.
- `TableManagementFinalQC.scss` forced the floor/filter panel into a full-width deck at a broad breakpoint. On scaled desktop viewports this produced a large empty surface, full-width filters, and narrow cards clustered on the left.
- The modal CRUD flow, restaurant permission check, GraphQL schema/resolvers, and Apollo hooks were already correct.

## End-to-end flow

1. `Table` and `Floor` models store type, capacity, floor and position.
2. `floor_table.graphql` exposes table/floor queries and mutations.
3. Table/floor resolvers preserve restaurant permissions and validation.
4. `useTableManagement` and `useFloorManagement` provide the Apollo operations.
5. `ManagerLayout` grants `table.write`, owns `showTableSettings`, and passes the opener into the table page wrapper.
6. `TableManagementSettingsEntry` mounts the action into the existing `ManagementPageHeader` control row and keeps `TableManagement` unchanged.
7. `TableTypeManagementPage` remains the controlled modal for type/space CRUD.

## Visual direction

Compact restaurant operations dashboard with a narrow stable floor/filter rail, fluid table cards, and every page-level action grouped in the existing header.

## Files changed

- `TableManagementSettingsEntry.jsx`: removes the detached toolbar and portals the permission-gated action into the existing header control row.
- `TableManagementSettingsEntry.scss`: keeps only action ordering and mobile width rules.
- `TableManagementFinalQC.scss`: replaces the conflicting full-width deck with a concise desktop rail, fluid table grid, and lower responsive collapse point.
- `TableManagementSettingsEntry.test.jsx`: verifies the header action opens settings and remains absent without an opener.

## Acceptance criteria

- The type/space action sits in the table page header and still opens the existing modal without changing `#tables`.
- Desktop keeps a compact floor/filter rail and uses the remaining width for table cards.
- Cards expand into fluid columns instead of clustering at the left.
- Tablet/mobile stack cleanly without horizontal overflow; touch targets remain at least 44 px.
- No changes to table/floor data contracts, permissions, CRUD behavior, POS guards, merge/split, VR, or floor designer flows.

## Validation plan

- `vitest run src/components/Dashboard_Manager/Table/TableManagementSettingsEntry.test.jsx`
- `vitest run src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
- `npm run build`

## Validation result

- Source files and import order were re-fetched after the writes.
- GitHub currently reports no status checks for the final commit.
- Vitest, build, and a rendered browser screenshot were not available through the GitHub connector session.

## Out of scope

- Rewriting the shared manager header or shared modal.
- Adding custom table type enum values.
- Changing table status, booking, payment, merge/split, QR, VR, or floor-map behavior.
