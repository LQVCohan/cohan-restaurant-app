# Dynamic roster staff resolution

## Current behavior

`applySharedRosterHoursDemo.js` looks up seven fixed demo email addresses before reading the roster. Databases that already contain valid staff and shifts under different accounts fail with `DEMO_STAFF_ACCOUNTS_MISSING` before any roster update runs.

## Root cause

The updater treats a specific seed account list as the source of truth. The actual source of truth is the set of employees referenced by the restaurant's existing shifts for the previous/current demo weeks.

## Traced flow

1. `Shift.employeeId` identifies the assigned employee for each existing roster row.
2. `Staff.employmentType` determines whether the planned shift should be 8 hours or 4 hours.
3. `Timesheet.shiftId` links historical attendance to the shift being updated.
4. `AttendanceCorrectionRequest.timesheetId` and `OvertimeRequest.timesheetId` link dependent workflow data.
5. The package scripts call the updater and verifier directly.

## Files

- `cohan-restaurant-backend/scripts/applySharedRosterHoursDemo.js`: resolve staff from existing roster shifts and remove fixed email scenarios.
- `cohan-restaurant-backend/scripts/verifySharedRosterHoursDemo.js`: verify the dynamically discovered roster without fixed employee/shift counts.

## Acceptance criteria

- The updater does not require any specific email address.
- It prefers the tagged performance roster and falls back to all restaurant shifts in `2026-06-29` through `2026-07-12` when no tagged roster exists.
- Only existing shifts are updated; no staff, shift, or timesheet is created.
- Full-time shifts become 8 hours and part-time shifts become 4 hours inside `07:00-23:00`.
- At least one full-time and one part-time employee must exist in the selected roster.
- The verifier supports variable staff and shift counts and checks linked timesheets and policy values.

## Validation

```bash
cd cohan-restaurant-backend
node --check scripts/applySharedRosterHoursDemo.js
node --check scripts/verifySharedRosterHoursDemo.js
npm run apply:demo:shared-roster-hours
npm run verify:demo:shared-roster-hours
```

Database commands require the user's demo MongoDB connection.

## Out of scope

- Creating missing employee accounts.
- Re-seeding the staff-performance dataset.
- Changing shifts outside the two existing demo weeks.
