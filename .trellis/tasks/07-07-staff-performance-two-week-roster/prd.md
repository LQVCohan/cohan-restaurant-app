# Staff performance two-week roster

## Current behavior

`seedStaffPerformanceDemo.js` creates four June shifts and four July shifts per demo employee. The current July dates stop at 04/07/2026, so the schedule has no complete data for the previous calendar week (29/06–05/07) or the current calendar week (06/07–12/07).

A shift alone is not enough for every UI path. Staff self-service shift visibility and manager attendance require a matching `SchedulePublication` in `published` or `active` state. Performance calculation also consumes both `Shift` and `Timesheet` records.

## Goal

Create a deterministic roster for:

- Previous week: 29/06/2026–05/07/2026
- Current week: 06/07/2026–12/07/2026

The roster must reuse the seven existing performance demo staff accounts and remain consistent with July performance snapshots.

## Flow traced

`Shift/Timesheet/SchedulePublication schemas -> staffShifts and managerShiftAttendances resolvers -> schedule queries in manager/staff UI -> staffPerformance.service scheduled/actual minutes -> performance snapshots -> verification scripts`.

## Data contract

- Restaurant: `69ce9e2e8d8d711f12e251b1`
- Manager: `69f7162dab80d0aaef80d5c8`
- Employees:
  - `staff.server.demo@cohan.local`
  - `staff.supervisor.demo@cohan.local`
  - `staff.cashier.demo@cohan.local`
  - `staff.chef.demo@cohan.local`
  - `staff.kitchenhelper.demo@cohan.local`
  - `staff.exception.demo@cohan.local`
  - `staff.parttime.demo@cohan.local`
- Exactly one shift and one timesheet per employee per calendar day for the fourteen-day demo window.
- Shift timestamps represent Vietnam local operating hours while remaining stored as UTC dates.
- Previous-week publication status: `published`.
- Current-week publication status: `active`.
- July attendance ratios and violation totals preserve the existing seven performance scenarios.

## Implementation constraints

- Do not create or replace accounts.
- Do not create menu data.
- Delete only shifts, timesheets, and correction requests carrying the performance demo tags inside the fourteen-day window.
- Keep June 02–05 historical performance data intact.
- Recalculate June and July snapshots after replacing the two-week attendance window.
- Preserve incident adjustments and appeal reversals.
- Use the existing local/demo safety guard.
- No dependency changes.

## Acceptance criteria

- 98 tagged shifts exist: 14 days × 7 employees.
- 98 matching timesheets exist.
- Every demo employee has one shift on every date from 29/06 through 12/07.
- There are no duplicate employee/date shifts.
- Both weekly schedule publications exist with visible lifecycle states.
- July snapshots still exist for all seven employees and retain the expected levels:
  `excellent`, `good`, `average`, `needs_attention`, `average`, `poor`, `good`.
- Running the seed repeatedly produces the same logical dataset.
- Existing performance verifier and the new roster verifier both finish with zero failures.

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
- Production or staging data
