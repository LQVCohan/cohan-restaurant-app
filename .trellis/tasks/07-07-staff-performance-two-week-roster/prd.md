# Staff performance two-week roster and profiles

## Current behavior

`seedStaffPerformanceDemo.js` creates four June shifts and four July shifts per performance employee. The current July dates stop at 04/07/2026, so the schedule has no complete data for the previous calendar week (29/06–05/07) or the current calendar week (06/07–12/07).

The manager staff screen already reads `employeeCode`, `phone`, verification state, `address`, `dateJoined`, `shiftType`, and `baseSalary`, but most scheduling demo accounts do not have those fields populated. The missing display values are therefore seed-data gaps, not schema, resolver, GraphQL, or UI contract gaps.

A shift alone is not enough for every UI path. Staff self-service shift visibility and manager attendance require a matching `SchedulePublication` in `published` or `active` state. Performance calculation also consumes both `Shift` and `Timesheet` records.

## Goal

Create deterministic demo data for:

- Previous week: 29/06/2026–05/07/2026
- Current week: 06/07/2026–12/07/2026
- Complete manager-visible profiles for the fourteen existing scheduling demo staff accounts

The data must reuse existing demo accounts and remain consistent with July performance snapshots.

## Flow traced

- Roster: `Shift/Timesheet/SchedulePublication schemas -> staffShifts and managerShiftAttendances resolvers -> schedule queries in manager/staff UI -> staffPerformance.service -> performance snapshots -> verification scripts`.
- Profiles: `User/Staff schemas -> sanitizeStaffPrivateProfile -> staff/staffList resolvers -> StaffFields Apollo fragment -> StaffManagement mapping -> EmployeeDetail rows -> verification script`.

## Data contract

- Restaurant: `69ce9e2e8d8d711f12e251b1`
- Manager: `69f7162dab80d0aaef80d5c8`
- Seven performance employees retain their existing `PERF-*` employee codes and expected performance scenarios.
- All fourteen existing scheduling demo staff accounts receive:
  - a unique employee code;
  - a unique synthetic Vietnamese phone number;
  - verified email and phone state;
  - a synthetic address in District 1, Ho Chi Minh City;
  - date joined and official start date;
  - position, department, employment type, and shift type;
  - positive base salary and active/working states.
- Exactly one shift and one timesheet per performance employee per calendar day for the fourteen-day demo window.
- Shift timestamps represent Vietnam local operating hours while remaining stored as UTC dates.
- Previous-week publication status: `published`.
- Current-week publication status: `active`.
- July attendance ratios and violation totals preserve the existing seven performance scenarios.

## Implementation constraints

- Do not create or replace accounts.
- Do not reset passwords or modify authentication secrets.
- Do not create menu data.
- Profile updates are restricted to the fourteen exact `@cohan.local` demo staff emails under the configured restaurant.
- Abort before profile updates when a target phone or employee code belongs to another account.
- Delete only shifts, timesheets, and correction requests carrying the performance demo tags inside the fourteen-day window.
- Keep June 02–05 historical performance data intact.
- Recalculate June and July snapshots after replacing the two-week attendance window.
- Preserve incident adjustments and appeal reversals.
- Use the existing local/demo safety guard.
- No dependency changes.

## Acceptance criteria

- 98 tagged shifts exist: 14 days × 7 employees.
- 98 matching timesheets exist.
- Every performance demo employee has one shift on every date from 29/06 through 12/07.
- There are no duplicate employee/date shifts.
- Both weekly schedule publications exist with visible lifecycle states.
- July snapshots still exist for all seven employees and retain the expected levels:
  `excellent`, `good`, `average`, `needs_attention`, `average`, `poor`, `good`.
- Fourteen staff profiles exist and each has non-empty employee code, phone, display address, date joined, shift type, base salary, verified email, and verified phone.
- All fourteen employee codes and phone numbers are unique.
- Running the seed repeatedly produces the same logical dataset.
- Performance, roster, and profile verifiers finish with zero failures.

## Validation

```bash
npm run seed:demo:staff-performance --prefix cohan-restaurant-backend
npm run verify:demo:staff-performance-data --prefix cohan-restaurant-backend
npm run test --prefix cohan-restaurant-backend -- tests/scripts/staff-performance-demo-scripts.test.js
npm run build --prefix cohan-restaurant-backend
```

## Out of scope

- Shift acknowledgements and schedule acknowledgement statistics
- Availability registration and leave requests
- Payroll generation for these two weeks
- Real employee identity, address, phone, or banking data
- Production or staging data
