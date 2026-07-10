# Compact menu serving fields

## Current behavior

The serving-mode selector includes a long helper paragraph and both the serving mode and method name span the full card width. This pushes price and preparation time into an uneven layout and makes a simple operational form feel crowded.

## Root cause and flow

The recipe contract is already correct: serving mode is stored in component state, normalized by `buildRecipeForm`, submitted through `useRecipes`, and persisted as a serving variant. The issue is only the render layout inside `MenuItemModal` and its local SCSS grid.

## Direction

Compact two-column operational form using the existing sage modal styles, concise labels, and no helper paragraph.

## Files to change

- `MenuItemModal.jsx`: remove the serving-mode description and use concise labels without changing state or payload behavior.
- `MenuItemModalPolish.scss`: arrange the four fields as a balanced two-by-two grid and retain the existing mobile single-column fallback.

## Acceptance criteria

- No descriptive paragraph appears under the serving-mode selector.
- Mode and method name share the first row; price and preparation time share the second row.
- Labels remain explicit and keyboard-accessible.
- Mobile widths continue to stack to one column.
- No schema, resolver, hook, permission, validation, or persistence change.

## Validation

- Re-fetch both changed files and inspect the final line ranges.
- Run the focused MenuItemModal Vitest when an executable checkout is available.
- Run the frontend build when an executable checkout is available.
