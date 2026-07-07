# Fix table merge picker opening

## Current behavior

The table detail modal renders a text field and a **Ghép bàn** button. The searchable picker is attached later by `installTableTransferMergeEnhancement`, which stores readiness on the containing group and binds a capture-phase listener to the button element that exists at that moment.

The screenshot after the first fix still showed the original `Ví dụ: A2, A3` placeholder and **Ghép bàn** label. This proves the rendered button was not enhanced, so clicking it reached the React merge handler with an empty `mergeCodes` value and returned without opening a picker.

## Root cause

The picker depends on a listener bound to one transient React DOM button. The group-level `mergePickerReady` flag can survive while React replaces or rerenders the actual button, and asynchronous observer timing can also leave the first rendered button unbound. A pointer/focus fallback still relied on that same per-element binding and therefore did not correct the unstable ownership boundary.

## End-to-end flow

1. `Table` stores `isJoinable` and `joinGroupId`.
2. `MergeTablesInput` accepts the restaurant, selected table IDs, and anchor table.
3. The `mergeTables` resolver validates restaurant permission, same-floor membership, anchor membership, and conflicting groups before updating tables and writing an audit event.
4. `useTableManagement` sends the mutation and synchronizes Apollo cache `joinGroupId` values.
5. `TableManagement` passes restaurant tables and mutation actions to `TableActionsLiteModal`.
6. `TableActionsLiteModal` owns the original merge action.
7. The existing enhancement supplies the searchable same-floor picker and converts selected codes back into the React input.
8. `installTableMergePickerTrigger` now owns the stable document-level trigger, rebinds a replaced React button when needed, and lets the existing picker and merge mutation continue unchanged.

## Scope

- Reuse the existing searchable picker, styles, same-floor filtering, grouped-table restrictions, and GraphQL mutation.
- Display the picker action explicitly as **Chọn bàn**.
- Use one delegated capture listener at the document boundary so the first click works even when React replaced the original button.
- Rebind only when the current button has not been prepared.
- Remove the previous pointer/focus listener patch from `main.jsx`.
- Keep installation safe across Vite HMR by disconnecting/replacing the trigger observer and click handler.

## Files changed

- `src/utils/installTableMergePickerTrigger.js`: stable trigger, button preparation, HMR cleanup, and explicit **Chọn bàn** label.
- `src/utils/installTableMergePickerTrigger.test.js`: focused first-click regression test.
- `src/main.jsx`: install the reliable trigger and remove the failed global interaction patch.
- `.trellis/tasks/07-08-fix-table-merge-picker/task.json`: task state and result.
- `.trellis/tasks/07-08-fix-table-merge-picker/prd.md`: corrected root cause and validation record.

## Acceptance criteria

- The table detail modal shows **Chọn bàn** instead of relying on manual code entry.
- The first click opens the existing searchable table picker.
- Confirming selected tables still reaches the original React `handleMerge` and GraphQL mutation.
- Keyboard-generated clicks follow the same delegated path.
- React rerenders and Vite HMR do not leave a stale unbound merge button.
- Same-floor filtering, grouped-table disabling, search, permissions, validation, audit logging, and Apollo synchronization remain unchanged.
- No dependency, schema, resolver, service, or styling-library change is introduced.

## Out of scope

- Rewriting the picker as a new React component.
- Changing merge/split business rules or allowing cross-floor merges.
- Changing the POS table action modal.
- Redesigning unrelated sections of the table detail modal.

## Validation plan

- Focused test: `vitest run src/utils/installTableMergePickerTrigger.test.js`.
- Existing picker regression: `vitest run src/utils/installTableTransferMergeEnhancement.test.js`.
- Repository checks when a runnable workspace or CI is available: `npm run check:conflicts` and `npm run build`.
- Review the final diff for duplicate listeners, HMR cleanup, and unintended schema/resolver changes.

## Validation result

The focused regression test was added, but no local test, build, or GitHub Actions workflow was available in the connected environment. The final code was re-fetched and reviewed for syntax, listener cleanup, replay/bypass behavior, and unchanged backend contracts.
