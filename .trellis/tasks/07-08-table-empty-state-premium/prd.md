# Upgrade empty table-management setup state

## Current behavior

When the selected restaurant has no floors, `TableManagement` renders an empty-state container with an icon, one sentence, and a shared `Button`.

The SCSS rule `.tm-empty span` targets every descendant span, including `Button`'s `.btn__text`. This gives the button label the empty-state icon dimensions and background, producing the large overlapping blue square visible in the screenshot.

The page also keeps table filters visible and uses “Thêm bàn” as the header primary action even though a table cannot be saved without a floor.

## Root cause and flow

The backend and GraphQL flow is correct:

1. Floor and table records are scoped by `restaurantId`.
2. `useFloorManagement({ restaurantId })` returns `floors`.
3. `useTableManagement({ restaurantId })` returns `tables`.
4. `TableManagement` derives the no-floor/no-table state.
5. The UI renders the wrong hierarchy and a broad CSS descendant selector corrupts the shared button markup.

This task changes only the presentation and action order at step 5.

## Visual direction

- Keep the established COHAN manager sage/cream palette.
- Use a compact operational onboarding card rather than a sparse centered placeholder.
- Show the real setup order: create floor → add tables → arrange floor plan.
- Keep typography and controls aligned with the existing table page.
- Avoid new dependencies, images, animation libraries, or generic blue/purple dashboard styling.

## Files to change

- `src/components/Dashboard_Manager/Table/TableManagement.jsx`
  - Derive a clear empty-state model.
  - Use “Tạo tầng đầu tiên” as the main action when no floor exists.
  - Hide irrelevant table filters until at least one floor exists.
  - Render a semantic three-step setup state.
- `src/components/Dashboard_Manager/Table/TableManagement.scss`
  - Replace broad descendant span styling with explicit empty-state classes.
  - Add desktop and mobile onboarding layout.
  - Add visible focus-safe CTA and compact sidebar setup note styling.
- `src/styles/TableManagerSageUX.css`
  - Narrow the remaining `.tm-empty span` override to the explicit icon class.
  - Apply the existing sage palette to the new setup elements.
- `src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
  - Assert the no-floor state shows the correct setup action and does not show unusable filters.

## Acceptance criteria

- The “Thêm tầng” / “Tạo tầng đầu tiên” button label is no longer styled as a 64px icon.
- A restaurant with zero floors sees a composed setup panel with three clear steps.
- The header main action creates the first floor instead of opening an unusable add-table modal.
- Table filters are hidden until floors exist.
- Existing filtered-empty, no-table, loading, error, and populated states continue to work.
- The layout remains usable at desktop and mobile widths.

## Out of scope

- Backend floor/table changes.
- New onboarding persistence or tours.
- New dependencies or image assets.
- Redesigning pages outside manager table management.

## Validation plan

- `vitest run src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
- `npm run build`
- Desktop screenshot comparison.
- Mobile checks at 390×844 and 430×932.
