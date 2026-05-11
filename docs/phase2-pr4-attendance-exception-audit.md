# Phase 2 PR 4 Audit: Attendance Exceptions

## 1. Existing Timesheet fields related to absent/no-show/missed checkout
- `Timesheet` already stores `shiftId`, `plannedStartTime`, `plannedEndTime`, `actualCheckInAt`, `actualCheckOutAt`, `workedMinutes`, `latenessMinutes`, `earlyLeaveMinutes`, `overtimeMinutes`, `status`, `isOffSchedule`, `source`, and `note`.
- The persisted status enum already supports `scheduled_absent`, but it did not have a dedicated `missed_checkout` value before this PR.
- Off-schedule review state already exists through `isOffSchedule`, `approved`, `offScheduleApprovalStatus`, and related review metadata.

## 2. Existing resolver/service behavior
- `upsertStaffAttendance` links attendance to an official `Shift` only when the overlapping schedule publication is not `draft` or `revision_draft`.
- `staffAttendanceRecords` reads from `Timesheet` and derives the output status from attendance timestamps rather than trusting the stored `status` string.
- Attendance correction services can create or update timesheets, including off-schedule correction flows, but there was no separate backend exception detector for no-show or missed checkout.

## 3. Whether no-show records are currently generated or only inferred
- Before this PR, no-show was mostly inferred from missing check-in state and from manually created `Timesheet` rows.
- There was no dedicated backend process that created a persisted official no-show record for a published/active assigned shift after a grace window.

## 4. Whether missed checkout is currently detected
- Before this PR, a checked-in record without checkout stayed in the generic `checked_in` state.
- The UI could see that `actualCheckOutAt` was missing, but the backend did not harden that into an idempotent missed-checkout detection pass.

## 5. What this PR changes
- Adds a focused attendance exception detection service for official scheduled shifts in published/active publications.
- Creates persisted `scheduled_absent` timesheets for no-show after a grace window without duplicating existing official records.
- Marks linked checked-in timesheets as `missed_checkout` after planned end plus grace, while leaving checkout timestamps untouched.
- Adds a lazy trigger at the `Timesheet` query layer for restaurant/date-range reads so manager attendance screens can surface official no-show rows without a broad resolver rewrite.
- Adjusts attendance page date-range helpers to send Asia/Ho_Chi_Minh day boundaries and labels overdue open shifts as `Thiếu check-out` while keeping off-schedule attendance distinct.

## 6. What remains for payroll/performance later
- Payroll and performance consumers still need a follow-up pass to decide how `missed_checkout` should affect salary calculation, absence penalties, and performance incidents.
- The current PR does not change payroll aggregation, salary formulas, performance scoring, or broader shift acknowledgement semantics.
