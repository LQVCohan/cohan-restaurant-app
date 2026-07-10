# Compact table 3D model picker

## Current behavior

The manager table 3D modal renders its catalog through `Table3DCatalogPanel`. Model filtering and selection are already local UI state and do not require backend, GraphQL, permission, persistence, or AR callback changes.

The latest desktop screenshot shows that each catalog item still uses a 60px thumbnail and a 78px minimum row with title, capacity, and badges stacked vertically. Only a few models fit in the available panel height. The vertical scroller can also stop between rows, leaving a partially visible item at the top that looks clipped.

## Root cause

The compact data is already available, but the final desktop presentation still inherits the larger card dimensions from `Table3DMainModalRepair.css`. This is a layout-density issue, not a component-flow or data-contract issue.

## Caller flow checked

1. `Table3DSimulatorModalV2` owns filter and selected-model state.
2. `Table3DCatalogPanel` renders the filtered models and calls the existing `onSelectModel` callback.
3. The selected model is consumed by the viewer and existing camera, AR, and apply actions.
4. No schema, resolver, service, Apollo operation, sanitizer, audit log, or realtime behavior is involved in this presentation-only change.

## Files to change

- `src/styles/Table3DModalContentSafety.css`: add the final desktop compact-row contract and scroll alignment.
- `.trellis/tasks/table-3d-model-picker-compact/task.json`: record completion and validation status.

## Acceptance criteria

- Desktop catalog rows are materially shorter while preserving readable thumbnails, names, capacity, and semantic badges.
- Model names stay on one line with ellipsis instead of colliding with adjacent rows.
- Capacity and badges share one compact metadata row.
- Vertical scrolling aligns rows instead of commonly stopping through the middle of a card.
- Selected, hover, focus, custom-delete, filter, keyboard, and click behavior remain unchanged.
- Mobile cards remain at least 44px tall and keep the existing horizontal carousel behavior.
- No dependency, component callback, backend, GraphQL, persistence, or AR behavior changes.

## Validation plan

- Review the final CSS cascade after all table styles.
- Confirm the focused component markup still matches the selectors.
- Run the focused Table 3D component test and production build when a runnable checkout is available.
- Manually inspect desktop plus 390x844 and 430x932 when a browser environment is available.
