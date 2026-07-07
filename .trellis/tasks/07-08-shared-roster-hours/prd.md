# Shared full-time and part-time roster hours

## Goal

Allow full-time and part-time employees to appear in the same restaurant roster with overlapping coverage. Keep the rule that one employee cannot receive two overlapping shifts.

Target restaurant: `69ce9e2e8d8d711f12e251b1`.

Demo operating time: `07:00` to `23:00` in Asia/Ho_Chi_Minh.

- Full-time shift: 8 hours.
- Part-time shift: 4 hours.
- Reuse the existing previous-week and current-week demo roster.

## Root cause

- Planned hours already come from `Shift.startTime` and `Shift.endTime`; actual hours already come from `Timesheet.hours`. A new persisted hours field would duplicate data.
- Backend overlap validation searches by `employeeId`, so it correctly blocks overlap only for the same employee.
- Frontend template validation rejected every overlapping time window, even when different employees should work at the same time.
- Creating another roster seed would duplicate the staff, shifts, and attendance data that already exist for `2026-06-29` through `2026-07-12`.

## Traced flow

1. Models: `Staff`, `Shift`, `Timesheet`, `AttendanceCorrectionRequest`, `OvertimeRequest`, `SchedulingPolicy`.
2. Service: `shiftAssignmentValidation.service.js` calculates planned hours from start/end and checks overlap per employee.
3. GraphQL: staff shift mutations validate before creating or updating assignments.
4. Frontend: `ShiftRulesModal` calls `validateShiftRules` before saving templates.
5. Existing demo flow: `seedStaffPerformanceWeekRoster.js` owns the seven employees, 98 shifts, attendance, corrections, overtime, publications, and performance snapshots for the two-week period.

## Implemented files

- `src/components/Dashboard_Manager/Schedule/utils/scheduleHelpers.js`: allow overlapping template windows while retaining valid-time checks.
- `src/components/Dashboard_Manager/Schedule/utils/scheduleHelpers.test.js`: test overlapping templates and invalid values.
- `cohan-restaurant-backend/scripts/applySharedRosterHoursDemo.js`: update the existing tagged roster in place; do not create staff, shifts, or timesheets.
- `cohan-restaurant-backend/scripts/verifySharedRosterHoursDemo.js`: verify the existing seven employees and 98 shifts after the update.
- `cohan-restaurant-backend/package.json`: expose an apply command and a verify command.

The updater changes only records carrying the existing staff-performance week tag. Manually created or unrelated restaurant data is not deleted or replaced.

## Validation

- Run focused frontend tests for schedule helpers.
- Run `npm run apply:demo:shared-roster-hours` against the existing demo data.
- Run `npm run verify:demo:shared-roster-hours`.
- Run pull-request CI.

## Non-goals

- Do not run the staff-profile seed again.
- Do not create another two-week roster.
- Do not weaken same-employee overlap protection.
- Do not add a redundant `hours` field to `Shift`.
- Do not redesign the automatic scheduler.
