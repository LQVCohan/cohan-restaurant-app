# Fix table merge picker opening

## Current behavior

The table detail modal renders a text field and a **Ghép bàn** button. The searchable table picker is not rendered by React; `installTableTransferMergeEnhancement` finds the portal DOM later, marks the field read-only, and attaches a capture-phase click listener that opens the picker.

When that asynchronous DOM enhancement has not run for the current modal instance, the field keeps the original `Ví dụ: A2, A3` placeholder. Clicking **Ghép bàn** then reaches `handleMerge` with an empty `mergeCodes` value and returns without feedback, so the action appears broken.

## Root cause

The user interaction depends only on a `MutationObserver` plus `requestAnimationFrame` to attach the picker listener after the modal portal is inserted. The mutation, observer callback, and user click are separate timing boundaries. The existing picker and merge mutation are valid, but the listener attachment is not guaranteed before the first interaction.

## End-to-end flow

1. `Table` stores `isJoinable` and `joinGroupId`.
2. `MergeTablesInput` accepts the restaurant, selected table IDs, and anchor table.
3. The `mergeTables` resolver validates restaurant permission, same-floor membership, anchor membership, and conflicting groups before updating the tables and writing an audit event.
4. `useTableManagement` sends the mutation and synchronizes Apollo cache `joinGroupId` values.
5. `TableManagement` passes the current restaurant tables and mutation actions to `TableActionsLiteModal`.
6. `TableActionsLiteModal` owns the original merge handler.
7. `installTableTransferMergeEnhancement` converts that action into a searchable same-floor picker, but currently attaches only after an asynchronous DOM observation.

## Scope

- Keep the existing picker UI and existing GraphQL query/mutation path.
- Ensure the modal enhancer is applied synchronously as soon as a pointer or keyboard focus enters a table detail modal.
- Preserve the current MutationObserver as the normal eager path.
- Prevent duplicate global fallback listeners during development reloads.

## Files to change

- `src/main.jsx`: add the small interaction-time fallback that calls the existing enhancer before the eventual click.
- `.trellis/tasks/07-08-fix-table-merge-picker/task.json`: track task state.
- `.trellis/tasks/07-08-fix-table-merge-picker/prd.md`: record the plan and validation.

## Acceptance criteria

- The first click on **Ghép bàn** opens the existing searchable table picker even when the observer has not enhanced the portal yet.
- Keyboard users who focus the merge control receive the same behavior.
- The existing same-floor filter, grouped-table disabling, search, selection, and merge mutation remain unchanged.
- No schema, resolver, permission, audit-log, dependency, or styling change is introduced.
- Installation remains idempotent during HMR or repeated module evaluation.

## Out of scope

- Redesigning the table detail modal.
- Rewriting the picker as a new React component.
- Changing merge/split business rules or allowing cross-floor merges.
- Changing the POS table action modal.

## Validation plan

- Run the focused `installTableTransferMergeEnhancement.test.js` test.
- Run the focused `TableActionsLiteModal.test.jsx` test if available in the environment.
- Run `npm run check:conflicts` and `npm run build` when CI or a repository workspace is available.
- Review the final diff for duplicate listeners and unintended changes outside `src/main.jsx` and the task artifacts.
