# Shared full-time and part-time roster hours

## Goal

Allow full-time and part-time employees to appear in the same restaurant roster with overlapping coverage. Keep the rule that one employee cannot receive two overlapping shifts.

Target restaurant: `69ce9e2e8d8d711f12e251b1`.

Demo operating time: `07:00` to `23:00` in Asia/Ho_Chi_Minh.

- Full-time shift: 8 hours.
- Part-time shift: 4 hours.
- The demo contains one completed week for attendance and one scheduled week for calendar testing.

## Root cause

- Planned hours already come from `Shift.startTime` and `Shift.endTime`; actual hours already come from `Timesheet.hours`. A new persisted hours field would duplicate data.
- Backend overlap validation searches by `employeeId`, so it correctly blocks overlap only for the same employee.
- Frontend template validation rejected every overlapping time window, even when different employees should work at the same time.
- The existing performance demo remains separate. A focused roster seed covers the missing employment-hour case without changing its performance data.

## Traced flow

1. Models: `Staff`, `Shift`, `Timesheet`, `SchedulingPolicy`.
2. Service: `shiftAssignmentValidation.service.js` calculates planned hours from start/end and checks overlap per employee.
3. GraphQL: staff shift mutations validate before creating or updating assignments.
4. Frontend: `ShiftRulesModal` calls `validateShiftRules` before saving templates.
5. Demo scripts create policy templates, shifts, historical attendance, and verification output.

## Implemented files

- `src/components/Dashboard_Manager/Schedule/utils/scheduleHelpers.js`: allow overlapping template windows while retaining valid-time checks.
- `src/components/Dashboard_Manager/Schedule/utils/scheduleHelpers.test.js`: test overlapping templates and invalid values.
- `cohan-restaurant-backend/scripts/seedSharedRosterHoursDemo.js`: seed fourteen employees, 8-hour full-time shifts, 4-hour part-time shifts, and overlapping coverage inside 07:00-23:00.
- `cohan-restaurant-backend/scripts/verifySharedRosterHoursDemo.js`: verify duration, operating boundaries, attendance hours, policy values, mixed-employment overlap, and no same-employee overlap.
- `cohan-restaurant-backend/package.json`: add focused seed and verify commands to the staff demo workflow.

The demo uses a distinct template key for each time window, so concurrent groups stay separate without changing the calendar component.

## Validation

- Run focused frontend tests for schedule helpers.
- Run `npm run seed:demo:shared-roster-hours` and `npm run verify:demo:shared-roster-hours` in an allowed demo database.
- Run pull-request CI.

## Non-goals

- Do not weaken same-employee overlap protection.
- Do not add a redundant `hours` field to `Shift`.
- Do not rewrite the existing performance, correction, or overtime demo.
- Do not redesign the automatic scheduler.
