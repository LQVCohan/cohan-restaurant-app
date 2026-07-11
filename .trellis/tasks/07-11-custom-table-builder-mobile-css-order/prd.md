# Custom table builder mobile CSS-order repair

## Current behavior

On a phone, the custom table model modal can fall back to the legacy responsive rules: the title wraps into a narrow column, the close control stretches, the four creation modes become a tall vertical list, labels merge with descriptions, and the form begins too far below the fold.

## End-to-end trace

1. `Table3DSimulatorModalV2` imports `Table3DSimulatorModal.scss`, opens `CustomTableModelBuilderModal`, persists the returned catalog item and selects it.
2. `CustomTableModelBuilderModal` owns the parametric, URL, upload and ordered five-photo AI forms; no GraphQL contract is involved.
3. `Modal` supplies the portal, focus trap, close control, bottom-sheet layout and page-scroll lock.
4. `CustomTableBuilderResponsiveFix.css` already targets the current builder DOM, but it is imported from `main.jsx` rather than from the feature component.

## Root cause

The responsive repair lives in the application entry while the table 3D SCSS is loaded with a route-level feature. In a production or lazy-loaded route, the feature stylesheet can be inserted after the global repair. Equal-specificity rules then restore the one-column mobile mode list and conflicting modal sizing. The screenshot matches that stylesheet-order failure, not a broken data or model-generation flow.

## Visual direction

Compact warm-neutral mobile bottom sheet with a stable header, a two-by-two mode selector using the existing Lucide icon family, one scroll owner, readable single-column fields and full-width phone actions.

## Files changing

- `src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.jsx`: import the scoped responsive repair with the component, use Lucide mode icons and expose the selected mode through `aria-pressed`.
- `src/main.jsx`: remove the global repair import so style ownership and order are deterministic.

## Acceptance criteria

- At 390x844 and 430x932, the title and 44px close control remain stable without overlap or stretching.
- Four creation modes render as a compact two-column/two-row selector; descriptions do not merge with labels.
- The active creation mode is visually clear and announced through button state.
- Form fields remain one column, at least 16px text size and free of horizontal overflow.
- The existing parametric, URL, upload and five-photo AI behavior is unchanged.
- No backend, GraphQL, storage, permission, dependency or shared modal change is introduced.

## Validation plan

- `npx vitest run src/components/Dashboard_Manager/Table/CustomTableModelBuilderModal.test.jsx`
- `npm run check:conflicts`
- `npm run build`
- Responsive browser checks at 390x844 and 430x932 when a browser/device session is available.
