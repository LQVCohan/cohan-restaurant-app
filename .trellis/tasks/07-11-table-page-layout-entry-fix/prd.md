# Table page layout and settings entry fix

## Current behavior and root cause

- `TableManagementSettingsEntry` renders a separate toolbar before the actual table page and offsets it with a negative margin, so the **Loại bàn & không gian** action floats outside the page header.
- `TableManagementFinalQC.scss` forces the floor/filter panel into a full-width deck at a broad breakpoint and constrains table cards through competing late-stage rules. On scaled desktop viewports this produces a large empty surface, full-width filters, and narrow cards clustered on the left.
- The modal CRUD flow, restaurant permission check, GraphQL schema/resolvers, and Apollo hooks are already correct.

## End-to-end flow

1. `Table` and `Floor` models store type, capacity, floor and position.
2. `floor_table.graphql` exposes table/floor queries and mutations.
3. Table/floor resolvers preserve restaurant permissions and validation.
4. `useTableManagement` and `useFloorManagement` provide the Apollo operations.
5. `ManagerLayout` grants `table.write`, owns `showTableSettings`, and passes the opener into the table page.
6. `TableManagement` renders the operational header, floor filters, cards and actions.
7. `TableTypeManagementPage` remains the controlled modal for type/space CRUD.

## Visual direction

Compact restaurant operations dashboard with a narrow stable floor/filter rail, fluid table cards, and all page-level actions grouped in the existing header.

## Files to change

- `TableManagement.jsx`: accept the existing opener and render it as a header secondary action.
- `TableManagementSettingsEntry.jsx`: remove the detached toolbar and forward the opener.
- `TableManagementSettingsEntry.scss`: delete unused detached-toolbar styling.
- `TableManagementFinalQC.scss`: replace the conflicting full-width deck with a concise responsive layout contract.
- `TableManagementSettingsEntry.test.jsx`: verify the opener is forwarded and absent without permission.

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

## Out of scope

- Rewriting the shared manager header or shared modal.
- Adding custom table type enum values.
- Changing table status, booking, payment, merge/split, QR, VR, or floor-map behavior.
