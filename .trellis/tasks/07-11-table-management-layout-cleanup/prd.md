# Manager table layout cleanup

## Current behavior and root cause

- The table model, GraphQL schema, query resolver, mutation resolver, and Apollo hook already return and update the real restaurant-scoped table data.
- `TableManagement.jsx` correctly filters tables by floor, status, area, and search, and routes create/update/status/merge/split actions through `useTableManagement`.
- The rendered page is visually fragmented because several historical table styles are loaded globally. The final effective contract is `TableManagementFinalQC.scss`.
- That final stylesheet forces a narrow sticky sidebar beside the list and constrains cards to `280px–360px` with `justify-content: start`. With a small number of tables, cards stay crowded on the left while most of the list panel is empty.
- Card metadata is rendered as four full-width rows and actions are squeezed into narrow cards, causing truncated labels and weak action hierarchy.

## End-to-end flow

1. `models/table.model.js` stores restaurant, floor, code, capacity, type, status, deposit, panorama, merge data, and position.
2. `graphql/schema/floor_table.graphql` exposes `tables`, create/update/move/status, merge/split, and QR operations.
3. `graphql/resolvers/table/query.js` enforces restaurant permissions, hides physical tables already merged into another table, and returns sorted table records.
4. `graphql/resolvers/table/mutation.js` validates restaurant/floor access, duplicate codes, state transitions, and writes table changes.
5. `useTableManagement.js` owns the Apollo query/mutations, cache updates, refetches, and realtime table-customer refresh.
6. `TableManagement.jsx` maps the records, applies client-side filters, opens table workflows, and renders the operational cards.
7. `TableManagementFinalQC.scss` is imported after the earlier table styles and therefore controls the final desktop/mobile layout.

## Visual direction

Full-width compact operational dashboard using the existing sage and warm-neutral palette: horizontal floor/filter controls, fluid table cards, a compact 2×2 metadata grid, and one obvious full-width operational action per table.

## Files to change

- `src/components/Dashboard_Manager/Table/TableManagementFinalQC.scss`
  - replace the desktop sidebar split with a full-width control deck;
  - make floor navigation and filters responsive horizontal grids;
  - let table cards fill available width instead of stopping at 360px;
  - compact metadata into a readable 2×2 grid;
  - preserve focus, touch targets, status semantics, mobile stacking, and reduced motion.

## Acceptance criteria

- Desktop no longer leaves a large unused blank area beside a few table cards.
- Floor navigation, add-floor action, search, status, and area filters are visually grouped without a tall sticky sidebar.
- Table cards remain readable from 280px upward and expand evenly across the available list width.
- Metadata and action labels are not truncated at normal desktop widths.
- The primary lifecycle action remains full width and visually stronger than 360/detail actions.
- Existing filtering, create/update/status, floor designer, VR, merge/split, permissions, and restaurant scoping behavior remain unchanged.
- No horizontal overflow at 375, 390, 430, 768, 1024, and 1440px.

## Validation plan

- `npm run check:conflicts`
- `vitest run src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
- `npm run build`
- Visual checks at 390×844, 430×932, 768px, 1024px, and 1440px.

## Out of scope

- Changing table status rules or POS-managed transitions.
- Changing GraphQL schema, resolver permissions, table persistence, merge/split semantics, QR behavior, or floor-map behavior.
- Rewriting the page component or adding a new UI library.
