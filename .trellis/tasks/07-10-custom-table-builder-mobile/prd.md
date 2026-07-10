# Custom table builder mobile repair

## Current behavior

The manager table 3D workspace opens `CustomTableModelBuilderModal` from `Table3DSimulatorModalV2`. The builder keeps all form, URL, upload and guided five-photo AI state locally, then returns one catalog item through `onApply`.

On a phone, the title wraps one word per line, the close control stretches, the four creation modes consume most of the viewport, labels and descriptions run together, and the form begins below an oversized navigation block.

## End-to-end trace

1. **Persistence/schema**: this modal does not call GraphQL or mutate table coordinates; generated catalog items are stored through the existing restaurant-scoped custom model storage after `onApply`.
2. **Caller**: `Table3DSimulatorModalV2` owns `showCustomBuilder`, opens the modal, persists the returned catalog item, selects it, and closes the builder.
3. **Builder state**: `CustomTableModelBuilderModal` owns parametric, URL, upload and AI forms and preserves the existing upload and five ordered rear-camera capture paths.
4. **Shared modal**: `Modal` provides portal rendering, focus trapping, page scroll locking and the mobile bottom-sheet container.
5. **Presentation**: `Table3DSimulatorModal.scss` already defines a structured builder header, tab list, scroll body, fields and footer, but the current JSX no longer emits that contract.
6. **Tests**: the focused builder test covers the five-photo AI flow and can also protect the tab/scroll-body markup contract.

## Root cause

The functional flow is intact. The visual failure is contract drift between the current JSX and the existing SCSS: the builder uses the shared modal's default header and automatic body wrapper, tab buttons lack `custom-table-builder__tab`, content uses `custom-table-builder__content` instead of the styled scroll body, and inputs/selects lack the local form classes. The mobile SCSS then worsens the problem by stacking all four mode buttons into a single column.

## Visual direction

Compact mobile bottom sheet using the existing warm neutral builder palette, a short two-column mode selector, one scroll owner, single-column fields and a reserved action footer.

## Scope

- Restore the existing structured builder DOM and class contract without changing data or submission logic.
- Use the shared modal without its duplicate default header/body wrapper.
- Keep the four modes accessible as tabs with visible selected state.
- Apply the existing local form-control classes to inputs, selects and textarea.
- Keep one internal scrolling body and a footer that does not cover form content.
- On phone widths, show the four modes as a compact two-column grid and hide secondary descriptions from the tab buttons.
- Keep controls at least 44px tall and inputs at least 16px font size on mobile.
- Add a narrow regression assertion for the tab and scroll-body contract.

## Acceptance criteria

- At 390x844 and 430x932, the title and close control remain on a stable header and do not stretch or overlap.
- Four creation modes fit in a compact two-row selector rather than one long vertical list.
- Tab labels remain readable and do not merge with descriptions.
- The active mode is exposed with `role="tab"` and `aria-selected`.
- Form fields use one column on mobile, fill the available width and do not trigger horizontal overflow or browser text auto-zoom.
- The builder has one predictable vertical scroll area; header/tabs/footer do not cover content.
- Existing parametric, URL, upload and guided five-photo AI actions remain unchanged.
- No backend, GraphQL, persistence, permission, dependency or shared modal behavior changes.

## Out of scope

- Redesigning the parent table 3D workspace.
- Changing model upload, AI provider, validation or storage contracts.
- Replacing the shared modal component or adding a UI library.

## Validation plan

- Focused Vitest for `CustomTableModelBuilderModal`.
- Conflict-marker check and frontend build.
- Manual responsive review at 390x844 and 430x932, plus the reported Android browser when available.
