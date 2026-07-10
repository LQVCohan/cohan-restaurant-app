# Table detail modal UI Pro Max polish

## Current behavior

The modal already separates content into tabs, but the visual hierarchy is still inherited from several legacy override layers. Summary values feel equal in importance, emoji are used as section icons, form controls are compact on touch devices, and the destructive area is not visually separated enough from normal configuration.

## Flow traced

`Table` Mongoose model -> `floor_table.graphql` -> table mutation resolver with restaurant permission/validation -> `useTableManagement` GraphQL operations and Apollo cache -> `TableManagement` passes current table/actions -> `TableActionsLiteModal` -> `installTableDetailModalTabs` presentation enhancement -> focused tests.

No schema, resolver, Apollo operation, mutation payload, restaurant scoping, permission, audit, or realtime behavior changes are required.

## Direction

Compact operational modal using warm neutral surfaces, sage emphasis, one clear save action, readable status hierarchy, Lucide-style icons, and progressive disclosure on mobile.

## Files

- `src/utils/installTableDetailModalTabs.js`: add stable semantic data attributes for summary rows and section kinds.
- `src/components/Dashboard_Manager/Table/TableDetailModalTabs.scss`: implement the final modal visual system and responsive behavior.
- `src/utils/installTableDetailModalTabs.test.js`: cover semantic decoration without changing tab behavior.

## Acceptance criteria

- Summary prioritizes status, floor, capacity, type, and area without repeating the table code already present in the title.
- Section icons use a consistent Lucide visual language instead of emoji.
- Controls and tabs have at least 44px touch targets and visible keyboard focus.
- Save action remains the single primary CTA; immediate operation copy remains visible.
- Destructive actions are visually isolated.
- Modal has no horizontal overflow at phone widths and inputs remain at least 16px on mobile.
- Existing mutation handlers, busy labels, draft behavior, and tab keyboard navigation remain unchanged.

## Validation

- `vitest run src/utils/installTableDetailModalTabs.test.js`
- `npm run build`
- Manual responsive review at 375, 768, 1024, and 1440px when a browser environment is available.

## Out of scope

- Backend or GraphQL contract changes.
- New dependencies or component libraries.
- Rewriting table business actions or persistence behavior.
