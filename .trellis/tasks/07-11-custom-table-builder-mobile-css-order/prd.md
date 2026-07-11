# Custom table builder mobile CSS-order repair

## Current behavior

On a phone, the custom table model modal could fall back to the legacy responsive rules: the title wrapped into a narrow column, the close control stretched, the four creation modes became a tall vertical list, labels merged with descriptions, and the form began too far below the fold.

## End-to-end trace

1. `Table3DSimulatorModalV2` imports `Table3DSimulatorModal.scss`, opens `CustomTableModelBuilderModal`, persists the returned catalog item and selects it.
2. `CustomTableModelBuilderModal` owns the parametric, URL, upload and ordered five-photo AI forms; no GraphQL contract is involved.
3. `Modal` supplies the portal, focus trap, close control, bottom-sheet layout and page-scroll lock.
4. `CustomTableBuilderResponsiveFix.css` is loaded globally, while the table 3D feature SCSS may be inserted later with the route.

## Root cause

The responsive repair and the route feature used equal-specificity mobile selectors. When the route stylesheet was inserted later, it could restore the one-column mode list and conflicting modal sizing. The screenshot matched that cascade-order failure, not a broken data or model-generation flow.

## Implemented direction

Compact warm-neutral mobile bottom sheet with a stable header, a two-by-two mode selector, one scroll owner, readable single-column fields and full-width phone actions.

## File changed

- `src/styles/CustomTableBuilderResponsiveFix.css`: anchored the repair selectors to both `.modal-container.custom-table-builder-modal` and `.custom-table-builder`, then tightened the phone header, tabs, controls, content scroll and action layout. This keeps the fix effective even when the route stylesheet is loaded later.

## Acceptance criteria

- At 390x844 and 430x932, the title and 44px close control remain stable without overlap or stretching.
- Four creation modes render as a compact two-column/two-row selector; descriptions do not merge with labels.
- The selected mode remains visually clear through the existing active state.
- Form fields remain one column, at least 16px text size and free of horizontal overflow.
- The existing parametric, URL, upload and five-photo AI behavior is unchanged.
- No backend, GraphQL, storage, permission, dependency, React state or shared modal behavior changes are introduced.

## Validation record

- Re-read the caller, builder component, shared modal, feature SCSS, responsive repair and entry import order.
- Re-fetched the committed stylesheet and reviewed the strengthened header, tab, grid, input and action selectors.
- GitHub reported no workflow runs or combined statuses for commit `398404c576264ded19549e49928f6102b1556f24`.
- Targeted Vitest, conflict-marker check and production build were not run because the GitHub connector does not provide a repository checkout with installed dependencies.
- 390x844, 430x932 and physical Android browser validation remain pending because no browser/device session is available through the connector.
