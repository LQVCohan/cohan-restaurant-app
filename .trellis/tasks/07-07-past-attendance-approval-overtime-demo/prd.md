# Past attendance, approval, and overtime demo

## Current behavior

The two-week roster seed creates shifts and timesheets for every date from 29/06/2026 through 12/07/2026. When run on 07/07/2026 in Vietnam, this produces completed attendance for 07/07–12/07 even though those dates have not passed.

The performance service also counts every non-cancelled shift through the requested period end. Removing future timesheets without excluding future shifts would incorrectly reduce productivity for the seeded in-progress month.

## Goal

Keep schedule visibility for both weeks, but create operational attendance data only for completed Vietnam calendar days. With demo as-of date 07/07/2026, the attendance cutoff is 06/07/2026.

Create representative historical data for:

- regular check-in/check-out, late arrival, early leave, and absence;
- attendance correction requests in pending, applied, rejected, and cancelled states;
- off-schedule attendance in pending, approved, and rejected states;
- timesheet overtime in pending, approved, and rejected states;
- employee overtime requests in pending employee confirmation, pending approval, approved, rejected, and completed states.

## Flow traced

`Timesheet / AttendanceCorrectionRequest / OvertimeRequest schemas -> attendance correction, off-schedule, attendance overtime, and overtime request services -> GraphQL resolvers -> useAttendanceManagement / useOvertimeManagement -> AttendancePage / OvertimePanel`.

Performance flow:

`Shift + Timesheet -> staffPerformance.service scheduled/actual minutes -> monthly performance snapshot`.

## Date contract

- Time zone: `Asia/Ho_Chi_Minh`.
- Demo as-of date defaults to `2026-07-07` and can be overridden with `DEMO_AS_OF_DATE=YYYY-MM-DD`.
- Attendance cutoff is the day before the as-of date.
- Roster window remains 29/06/2026–12/07/2026.
- Future dates retain `Shift` rows with status `scheduled`.
- Future dates must not have demo `Timesheet`, correction, off-schedule approval, or overtime rows.

## Data contract for 07/07/2026

- 98 roster shifts: 14 days × 7 performance employees.
- 56 regular timesheets: 8 completed dates × 7 employees.
- 3 off-schedule timesheets: pending, approved, rejected.
- 16 correction requests: 14 performance-countable pending/applied/rejected records plus 2 cancelled examples.
- 5 overtime-bearing timesheets with pending, approved, and rejected approval states.
- 5 overtime requests with pending employee confirmation, pending approval, approved, rejected, and completed states.
- All requested/reviewed/completed timestamps are before 07/07/2026.

## Performance handling

The seed temporarily changes only its future tagged shifts to `cancelled` while recalculating the demo snapshot, then restores them to `scheduled`. This keeps final schedule visibility while preventing future work from reducing the seeded current-month productivity score. The snapshot records `attendanceDataAsOf` and `attendanceDataCutoff` for auditability.

## Safety

- Use the existing demo-script environment guard.
- Restrict all seed changes to the configured restaurant and exact demo employee emails.
- Delete only records carrying the staff-performance demo tags.
- Do not create accounts, change passwords, or alter menu data.
- Do not modify payroll-locked data.

## Acceptance criteria

- No demo attendance record exists on or after the as-of date.
- Future roster shifts remain visible and use status `scheduled`.
- Past roster shifts use status `completed`.
- Attendance page shows regular attendance and all intended review states.
- Overtime panel shows both timesheet overtime and employee overtime requests across intended states.
- Existing expected performance levels remain valid.
- Seed is idempotent.
- Verifier exits with `FAIL=0`.

## Validation

```bash
npm run seed:demo:staff-performance --prefix cohan-restaurant-backend
npm run verify:demo:staff-performance-data --prefix cohan-restaurant-backend
npm run test:performance --prefix cohan-restaurant-backend
npm run build --prefix cohan-restaurant-backend
```
