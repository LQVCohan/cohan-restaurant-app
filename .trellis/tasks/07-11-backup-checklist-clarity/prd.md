# Backup checklist clarity

## Current behavior

The summary reflects the newest saved preparation run, but the editor could silently show an older completed run while a newly created run was still refetching. The screen therefore looked fully checked even though export was validating a different, unsaved run.

## Root cause

`selectedRunId` was resolved with a fallback to the first historical run. During the short interval before Apollo returned the newly created run, that fallback replaced the new selection with the older run.

## Scope

- Preserve an explicitly selected or newly created run while data is refetching.
- Label the summary as saved checklist progress.
- Distinguish the newest run from history.
- Explain whether required checks are missing, selected but unsaved, or ready.
- Prevent the visible old run from being mistaken for the run used by export.

## Acceptance criteria

- Starting a new checklist never leaves the editor showing the previous completed run.
- The header clearly says `Checklist đã lưu`.
- A complete draft that has not been saved shows an explicit save instruction.
- Selecting history shows a warning that export uses the newest run.
- When the newest saved run is known and incomplete, download is blocked before calling the mutation.
- Existing restaurant scoping, permissions, export contents, restore flow, and audit behavior remain unchanged.

## Out of scope

- Changing backup file contents or the backend export contract.
- Adding checklist fields.
- Redesigning restore conflict resolution.
- Adding runtime dependencies.
