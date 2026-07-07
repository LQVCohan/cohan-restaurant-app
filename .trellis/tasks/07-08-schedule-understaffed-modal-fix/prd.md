# Schedule staffing status and add-shift modal fix

## Current behavior

- The weekly board can keep the injected message `Tuần này chưa có ca` after shift cards have loaded.
- A shift detail can show `Đủ nhân sự` while the assigned list is empty because coverage compares raw assignment IDs with an empty inferred role list.
- The add-shift modal does not summarize missing required roles before submit and uses clickable `div` elements for role and employee selection.

## Root cause

1. `markBoardEmptyState` returns when the guidance node already exists, so it never reevaluates the message after asynchronous shift rendering.
2. `ShiftDetailModal` counts raw assignment IDs rather than staff records that can actually be resolved from the scoped `staffList` query.
3. When a grouped shift has no explicit role requirement, the detail modal treats zero roles as zero required people and therefore reports the shift as complete.
4. The add-shift form already has role and employee data but does not derive or present a live coverage summary; custom clickable containers also weaken keyboard semantics.

## End-to-end flow

- Persistence: `Shift` stores one required `employeeId` per assignment row.
- Server: `staffShifts` returns assignment rows; `staffList` returns current scoped, non-deleted employee profiles after restaurant access checks.
- Client contract: `GET_STAFF_SHIFTS` and `GET_STAFF_LIST` load both sets; `ScheduleManagement` groups rows by date and shift type.
- UI: `ShiftCard`, `ShiftDetailModal`, and `AddShiftModal` display coverage and perform manager actions.
- Tests: focused component tests cover modal selection and coverage messaging; the manager schedule E2E copy is aligned with the revised modal.

## Scope

- Reevaluate board guidance whenever shift cards change: show an understaffed summary when critical cards exist, remove the guidance when all visible shifts are staffed, and keep the empty message only when there are no shift cards.
- Calculate detail coverage from resolvable employees, while requiring at least one person when the shift has no explicit role requirements.
- Surface unresolved assignment records instead of silently reporting them as staffed.
- Add a compact live coverage summary to the add-shift modal.
- Preserve mandatory policy roles in the add-shift form and report which required positions are still missing.
- Replace clickable selection containers with native buttons and preserve the existing create-shift contract.
- Improve sentence-case wording, accessible names, focus states, and live error/status feedback.

## Acceptance criteria

- A board containing understaffed shift cards displays a message that shifts exist and identifies how many still need staff; it does not display `Tuần này chưa có ca`.
- A board with staffed shift cards does not retain stale empty or understaffed guidance.
- A shift with zero resolvable employees displays `Thiếu 1 người`, not `Đủ nhân sự`.
- The detail modal distinguishes assigned profiles from unresolved assignment records.
- The add-shift modal shows selected headcount and missing required roles before submission.
- Role and employee choices are keyboard-operable native buttons with pressed state.
- Existing create-shift payload fields and backend validation remain unchanged.

## Out of scope

- Creating persisted empty shift groups; the current `Shift` model requires an employee assignment.
- Changing scheduling policy semantics, GraphQL schema, permissions, audit logging, or realtime behavior.
- Redesigning the full schedule page.

## Validation plan

- Run the focused `AddShiftModal` component test.
- Run the focused `ShiftDetailModal` coverage test.
- Run the manager schedule P1 E2E test.
- Run lint and the frontend build if a repository checkout is available.
- Review the final diff for contract drift and unrelated file changes.
