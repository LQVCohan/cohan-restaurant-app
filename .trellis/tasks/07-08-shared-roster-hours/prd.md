# Shared full-time and part-time roster hours

## Goal

Allow full-time and part-time employees to appear in the same restaurant roster with overlapping coverage. Keep the rule that one employee cannot receive two overlapping shifts.

Target restaurant: `69ce9e2e8d8d711f12e251b1`.

Demo operating time: `07:00` to `23:00` in Asia/Ho_Chi_Minh.

- Full-time shift: 8 hours.
- Part-time shift: 4 hours.
- Other employment types use scenario-appropriate durations inside the operating time.

## Current behavior and root cause

- Planned hours already come from `Shift.startTime` and `Shift.endTime`; actual hours already come from `Timesheet.hours`. A new persisted hours field would duplicate data.
- Backend overlap validation searches by `employeeId`, so it correctly blocks overlap only for the same employee.
- Frontend template validation currently rejects every overlapping time window, even when different employees should work concurrently.
- The manager schedule groups rows only by date and shift type, so the same type with different start/end times can be merged visually.
- The staff performance seed currently creates eight-hour shifts for every employee, including part-time staff.

## Traced flow

1. Models: `Staff`, `Shift`, `Timesheet`, `SchedulingPolicy`.
2. Service: `shiftAssignmentValidation.service.js` calculates hours from start/end and checks overlap per employee.
3. GraphQL: staff shift mutations validate before creating or updating assignments.
4. Frontend: `ScheduleManagement.jsx` loads shift rows and groups them for the calendar.
5. Seed and verifier: scripts create and verify roster, attendance, corrections, overtime, and performance data.

## Minimal file plan

- `src/components/Dashboard_Manager/Schedule/utils/scheduleHelpers.js`: permit overlapping template windows while retaining valid-time checks.
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`: include start/end time in the group key.
- `cohan-restaurant-backend/scripts/seedStaffPerformanceWeekRoster.js`: use scenario-specific durations within 07:00-23:00.
- `cohan-restaurant-backend/scripts/verifyStaffPerformanceWeekRoster.js`: verify durations, boundaries, and mixed-employment overlap.
- Add a focused helper test where the existing test structure supports it.

## Validation

- Run focused frontend tests for schedule helpers.
- Run the demo verifier in an allowed demo environment.
- Run lint/build or use pull-request CI.

## Non-goals

- Do not weaken same-employee overlap protection.
- Do not add a redundant `hours` field to `Shift`.
- Do not redesign the automatic scheduler beyond this mixed-roster requirement.
