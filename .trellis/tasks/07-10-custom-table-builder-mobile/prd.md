# Custom table builder mobile repair

## Current behavior

The manager table 3D workspace opens `CustomTableModelBuilderModal` from `Table3DSimulatorModalV2`. The builder keeps all form, URL, upload and guided five-photo AI state locally, then returns one catalog item through `onApply`.

On a phone, the title wraps one word per line, the close control stretches, the four creation modes consume most of the viewport, labels and descriptions run together, and the form begins below an oversized navigation block.

## End-to-end trace

1. **Persistence/schema**: this modal does not call GraphQL or mutate table coordinates; generated catalog items are stored through the existing restaurant-scoped custom model storage after `onApply`.
2. **Caller**: `Table3DSimulatorModalV2` owns `showCustomBuilder`, opens the modal, persists the returned catalog item, selects it, and closes the builder.
3. **Builder state**: `CustomTableModelBuilderModal` owns parametric, URL, upload and AI forms and preserves the existing upload and five ordered rear-camera capture paths.
4. **Shared modal**: `Modal` provides portal rendering, focus trapping, page scroll locking and the mobile bottom-sheet container.
5. **Presentation**: `Table3DSimulatorModal.scss` mainly targets a newer structured builder contract while the current JSX uses direct tab buttons, `custom-table-builder__content` and unclassified native controls.
6. **Import order**: global responsive styles load after the component SCSS and can override portal-rendered controls unless the builder repair is loaded last.

## Root cause

The functional flow is intact. The visual failure is presentation contract drift plus stylesheet order: the current JSX does not receive the newer tab, scroll-body and form-control rules, the existing phone breakpoint stacks all four modes into one column, and later global responsive styles can stretch the shared modal close control again.

The smallest safe fix is a final stylesheet scoped to `.custom-table-builder-modal` that styles the actual current DOM. This avoids touching the working upload, catalog and five-photo AI logic.

## Visual direction

Compact mobile bottom sheet using the existing warm neutral builder palette, a short two-column mode selector, one scroll owner, single-column fields and full-width phone actions.

## Files changed

- `src/styles/CustomTableBuilderResponsiveFix.css`: final scoped layout and control repair for the actual modal DOM.
- `src/main.jsx`: loads the repair after `ResponsiveFoundation.css` so it remains the final responsive layer for this modal.

## Implemented scope

- Constrain the shared header title and force the close control to a stable 44x44px target.
- Remove extra body padding and keep the builder content as the single internal scroll owner.
- Style the current direct mode buttons with clear active, focus, pressed and disabled-safe states.
- Use four columns on wider screens and a compact two-column/two-row selector on phones.
- Hide secondary mode descriptions on phones while keeping the primary labels visible.
- Style the current native inputs, selects, textarea and file controls without changing JSX or form state.
- Use one form column, 16px control text and full-width primary actions on phones.
- Add missing current-DOM styles for table-shape choices and danger feedback.
- Preserve reduced-motion behavior.

## Acceptance criteria

- At 390x844 and 430x932, the title and close control remain on a stable header and do not stretch or overlap.
- Four creation modes fit in a compact two-row selector rather than one long vertical list.
- Mode labels remain readable and do not merge with their descriptions.
- Form fields use one column on mobile, fill the available width and do not trigger horizontal overflow or browser text auto-zoom.
- The builder has one predictable vertical scroll area and controls do not cover content.
- Touch targets for close, modes, shape choices and primary actions are at least 44px.
- Existing parametric, URL, upload and guided five-photo AI actions remain unchanged.
- No backend, GraphQL, persistence, permission, dependency or shared modal behavior changes.

## Out of scope

- Redesigning the parent table 3D workspace.
- Changing model upload, AI provider, validation or storage contracts.
- Replacing the shared modal component or adding a UI library.
- Refactoring the legacy builder JSX in this visual-only repair.

## Validation record

- Re-read the caller, builder component, shared modal, component SCSS and final global responsive import order.
- Re-fetched the committed stylesheet and `main.jsx` import to confirm the final code.
- GitHub reported no workflow runs or combined statuses for the latest code commit.
- Focused Vitest, conflict-marker check and production build were not run because the GitHub connector does not provide a checkout with installed dependencies.
- 390x844, 430x932 and physical Android browser validation remain pending because no browser/device session is available through the connector.
