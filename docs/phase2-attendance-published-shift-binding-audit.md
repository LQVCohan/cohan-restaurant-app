# Phase 2 PR 1 Audit — Attendance Binding to Published Schedules

## Scope

This note documents the scheduling -> attendance audit for Phase 2 PR 1. It intentionally does not cover payroll, performance, POS, payment, voucher, cart, customer ordering, inventory, or unrelated scheduling UI polish.

## Current attendance model

The backend attendance record is stored in `Timesheet`.

Existing fields already support the Phase 2 binding target:

- `employeeId`
- `restaurantId`
- `workDate`
- `shiftId`
- `plannedStartTime`
- `plannedEndTime`
- `actualCheckInAt`
- `actualCheckOutAt`
- `latenessMinutes`
- `earlyLeaveMinutes`
- `overtimeMinutes`
- `workedMinutes`
- `hours`
- `status`
- `isOffSchedule`
- `offScheduleApprovalStatus`
- off-schedule review fields

Because these fields already exist, this PR does not add Timesheet schema fields.

## Current resolver/query behavior

- Check-in/check-out is handled by `upsertStaffAttendance` in `cohan-restaurant-backend/graphql/resolvers/staff/mutation.js`.
- Existing historical audit notes say check-in currently attempts to find a shift for the day; if one is found, it creates/updates a Timesheet linked by `shiftId`; otherwise it creates/updates an off-schedule Timesheet.
- `staffAttendanceRecords` in `cohan-restaurant-backend/graphql/resolvers/staff/query.js` already returns `shiftId`, `plannedStartTime`, `plannedEndTime`, late/early/overtime minutes, status, and off-schedule fields.
- The Staff/Manager frontend already requests these attendance fields through `useAttendanceManagement.js`.

## Required hardening target

Attendance should bind only to an official schedule shift:

1. Same employee.
2. Same restaurant.
3. Shift time matches the current check-in/check-out window.
4. The containing `SchedulePublication` effective status is `published` or `active`.
5. `draft` and `revision_draft` shifts are not official attendance schedules.
6. If no official shift matches, the Timesheet must remain off-schedule and pending review instead of silently becoming scheduled attendance.

## Timezone/date safety

The tests added for this PR avoid exact timestamp equality for day matching and include an overnight shift case where `endTime` is the following day. Backend logic should use date ranges/time windows, not browser-local date-string equality.

## Payroll readiness gaps intentionally left out

This PR does not calculate payroll money, salary, performance score, or advanced overtime payout. It only protects clean attendance schedule linkage and basic late/early/off-schedule classification needed for later payroll/performance phases.
