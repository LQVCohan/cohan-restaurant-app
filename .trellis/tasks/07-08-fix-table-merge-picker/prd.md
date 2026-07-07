# Fix table merge picker opening

## Current behavior

The React table-detail modal still renders a manual merge-code field and a **Ghép bàn** button. Earlier fixes tried to attach a searchable picker afterward through a `MutationObserver`, a capture listener bound to the current button element, and a replayed click.

The user screenshots continued to show the original manual-entry UI. This meant the picker action was not visible and the rendered React button could still reach `handleMerge` with an empty value.

The detail modal was also constrained by several later style layers to roughly 1010px, leaving long forms and the 360-degree section visually cramped on desktop.

## Root cause

The picker did not have a stable, visible interaction owned at the document boundary. Its behavior depended on one transient React button and could conflict with stale observer/listener instances retained by Vite HMR. Replaying the same button click also made the flow difficult to reason about.

The modal width issue came from final table-workflow SCSS overrides loaded after the component's inline defaults.

## End-to-end flow

1. `Table` stores `isJoinable` and `joinGroupId`.
2. `MergeTablesInput` accepts the restaurant, selected table IDs, and anchor table.
3. The `mergeTables` resolver validates restaurant permission, same-floor membership, anchor membership, and conflicting groups before updating tables and writing an audit event.
4. `useTableManagement` sends the mutation and synchronizes Apollo cache `joinGroupId` values.
5. `TableManagement` passes the current restaurant tables and mutation actions to `TableActionsLiteModal`.
6. `TableActionsLiteModal.handleMerge` parses the selected codes and invokes the existing mutation.
7. `installTableMergePickerTrigger` now adds a visible **Chọn bàn từ danh sách** control, loads the latest table list directly through Apollo, and writes selected same-floor codes into the existing React field.
8. The user explicitly presses **Ghép bàn đã chọn** to execute the unchanged React mutation path.

## Scope

- Add a visible **Chọn bàn từ danh sách** button directly below the merge selection field.
- Make the field read-only so table selection follows one clear path.
- Search candidates by table code, status, capacity, and type.
- Limit candidates to the current floor and exclude the current table.
- Show tables already belonging to another group as disabled.
- Preserve selected codes when reopening the picker.
- Keep Escape, focus trapping, focus return, visible focus, mobile bottom-sheet behavior, and reduced-motion support.
- Disconnect stale observer and click-handler keys left by previous HMR versions.
- Widen the table-detail modal to `min(1240px, 96vw)` on desktop while retaining responsive limits.
- Remove the obsolete `installTableTransferMergeEnhancement` implementation and its duplicate test after confirming they have no runtime callers.

## Files changed

- `src/utils/installTableMergePickerTrigger.js`: explicit picker control, direct Apollo loading, search/filter/selection, stable delegated click handling, and legacy HMR cleanup.
- `src/components/Dashboard_Manager/Table/TableManagementMergePickerFix.css`: wider detail modal and complete responsive picker presentation.
- `src/main.jsx`: load the final modal/picker CSS after earlier theme overrides.
- `src/utils/installTableMergePickerTrigger.test.js`: regression coverage for visible control, same-floor filtering, search, disabled grouped tables, selection, and empty native-button fallback.
- Removed `src/utils/installTableTransferMergeEnhancement.js` and `src/utils/installTableTransferMergeEnhancement.test.js` to keep one picker implementation.
- Task artifacts in this directory.

## Acceptance criteria

- The detail modal is visibly wider on desktop and remains within the viewport.
- The merge section always displays **Chọn bàn từ danh sách**.
- Clicking that control opens a searchable modal on the first attempt.
- Clicking an empty native **Ghép bàn** action also opens the picker instead of silently returning.
- Only same-floor tables are selectable; the current table is excluded.
- Tables in another merge group are visible but disabled.
- Confirming selection fills the existing merge field and changes the action to **Ghép bàn đã chọn**.
- Executing the final merge still reaches the existing `handleMerge`, Apollo mutation, resolver validation, permissions, cache update, and audit log.
- No schema, resolver, service, permission, dependency, or business-rule change is introduced.

## Out of scope

- Changing merge/split business rules or allowing cross-floor merges.
- Changing the POS table action modal.
- Rewriting the full table-detail form as a new component.

## Validation plan

- Focused test: `vitest run src/utils/installTableMergePickerTrigger.test.js`.
- Existing table-detail test: `vitest run src/components/Dashboard_Manager/Table/TableActionsLiteModal.test.jsx`.
- Repository checks when a runnable workspace or CI is available: `npm run check:conflicts` and `npm run build`.
- Desktop and narrow-screen browser verification of modal width, keyboard focus, search, selection, and final merge action.

## Validation result

Focused regression tests were updated in the repository. The connected environment did not provide a runnable checkout, so Vitest, build, browser smoke testing, and screenshot comparison were not executed here. The final files were re-fetched for import order, selector scope, stale-listener cleanup, direct Apollo flow, duplicate-code removal, and unchanged backend contracts.
