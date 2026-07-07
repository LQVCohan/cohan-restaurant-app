# Schedule staffing status and add-shift modal fix

## Current behavior

- The weekly board can keep the injected message `Tuần này chưa có ca` after shift cards have loaded.
- A shift detail can show `Đủ nhân sự` while the assigned list is empty because coverage compares raw assignment IDs with an empty inferred role list.
- The add-shift modal does not summarize missing required roles before submit and uses clickable `div` elements for role and employee selection.

## Root cause

1. `markBoardEmptyState` returns when the guidance node already exists, so it never removes stale guidance after asynchronous shift rendering.
2. `ScheduleManagement` reconstructs `essentialJobs` only from currently resolved assigned employees and does not seed the group from `mandatoryShiftRoles`.
3. `ShiftDetailModal` counts raw IDs rather than staff records that can actually be resolved from the scoped staff query, and treats zero required roles as zero required people.
4. The add-shift form has the required data but does not derive and present a live coverage summary; custom clickable containers also weaken keyboard semantics.

## End-to-end flow

- Persistence: `Shift` stores one required `employeeId` per assignment row.
- Server: `staffShifts` returns assignment rows; `staffList` returns current scoped, non-deleted employee profiles after restaurant access checks.
- Client contract: `GET_STAFF_SHIFTS` and `GET_STAFF_LIST` load both sets; `ScheduleManagement` groups rows by date and shift type.
- UI: `ShiftCard`, `ShiftDetailModal`, and `AddShiftModal` display coverage and perform manager actions.
- Tests: focused component tests cover modal selection and coverage messaging.

## Scope

- Remove stale empty-week guidance when any shift card exists.
- Preserve policy-required roles when grouping visible shifts.
- Calculate detail coverage from resolvable employees, with a minimum requirement of one person.
- Surface unresolved assignment records instead of silently reporting them as staffed.
- Add a compact live coverage summary to the add-shift modal.
- Replace clickable selection containers with native buttons and preserve existing styles.
- Improve sentence-case wording, accessible names, and live error/status feedback.

## Acceptance criteria

- A board containing shift cards never displays `Tuần này chưa có ca`.
- A shift with zero resolvable employees displays `Thiếu 1 người`, not `Đủ nhân sự`.
- Mandatory scheduling roles remain represented in grouped shift requirements.
- The detail modal distinguishes assigned profiles from unresolved assignment records.
- The add-shift modal shows selected headcount and missing required roles before submission.
- Role and employee choices are keyboard-operable native buttons with pressed state.
- Existing create-shift payload and backend validation remain unchanged.

## Out of scope

- Creating persisted empty shift groups; the current `Shift` model requires an employee assignment.
- Changing scheduling policy semantics, GraphQL schema, permissions, audit logging, or realtime behavior.
- Redesigning the full schedule page.

## Validation plan

- Run the focused `AddShiftModal` component test.
- Add and run a focused `ShiftDetailModal` coverage test.
- Run GraphQL checks and the frontend build if the environment is available.
- Review the final diff for duplicated coverage logic and contract drift.
