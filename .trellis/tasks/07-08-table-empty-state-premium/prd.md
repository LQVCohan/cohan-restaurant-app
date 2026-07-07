# Upgrade empty table-management setup state

## Current behavior

When the selected restaurant has no floors, `TableManagement` renders an empty-state container with an icon, one sentence, and a shared `Button`.

The legacy rule `.tm-empty span` also targets `Button`'s `.btn__text`. That gives the button label the empty-state icon dimensions and background, producing the large overlapping square shown in the screenshot.

The page also keeps table filters visible and uses “Thêm bàn” as the main header action even though a table cannot be saved before a floor exists.

## Root cause and flow

The backend and GraphQL flow is correct:

1. Floor and table records are scoped by `restaurantId`.
2. `useFloorManagement({ restaurantId })` returns floors.
3. `useTableManagement({ restaurantId })` returns tables.
4. `TableManagement` renders the no-floor/no-table state.
5. Legacy visual override layers corrupt the shared button label and expose actions in the wrong setup order.

The repository already loads table-specific final polish files and idempotent DOM installers from `main.jsx`. This task reuses that existing pattern so the fix loads after all older table overrides without rewriting table business logic.

## Visual direction

- Keep the COHAN manager sage/cream palette.
- Replace the sparse placeholder with a compact operational onboarding card.
- Show the actual setup order: create floor → add tables → arrange floor plan.
- Preserve keyboard focus, reduced-motion handling, loading states, and error states.
- Add no dependency, image asset, or generic blue/purple dashboard styling.

## Files changed

- `src/styles/TableEmptyStatePremium.css`
  - Neutralizes the broad legacy styling applied to `.btn__text`.
  - Adds the desktop/mobile sage onboarding layout.
  - Hides unusable filters while no floor exists.
  - Adds visible focus and reduced-motion behavior.
- `src/utils/installTableEmptyStateEnhancement.js`
  - Detects the real no-floor DOM state.
  - Adds semantic onboarding copy and three setup steps.
  - Reuses the existing add-floor button for both empty-state and header actions.
  - Avoids changing loading/error states and restores the normal UI when floors appear.
- `src/utils/installTableEmptyStateEnhancement.test.js`
  - Covers no-floor enhancement, action forwarding, and the existing-floor path.
- `src/main.jsx`
  - Loads the final CSS layer and installs the enhancement with the existing table utilities.

## Acceptance criteria

- The “Tạo tầng đầu tiên” button label is no longer styled as an icon tile.
- A restaurant with zero floors sees a composed setup panel with three clear steps.
- The header main action opens the existing add-floor flow instead of add-table.
- Table filters are hidden until floors exist.
- Loading and error states are not treated as an empty restaurant.
- Once a floor exists, the original table-management state and wording are restored.
- The layout adapts at 760px and 430px breakpoints.

## Out of scope

- Backend floor/table changes.
- New onboarding persistence or guided tours.
- New dependencies or image assets.
- Redesigning pages outside manager table management.

## Validation plan

- `vitest run src/utils/installTableEmptyStateEnhancement.test.js`
- Existing table-management component tests.
- `npm run build`
- Desktop screenshot comparison.
- Mobile checks at 390×844 and 430×932.

## Validation result

The focused test and build were not executed in the connected environment. GitHub returned no workflow run for the final code commit, so no CI pass is claimed.
