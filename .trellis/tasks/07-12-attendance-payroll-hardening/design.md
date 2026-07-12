# Design

## Flow traced

`Timesheet schema -> staff attendance mutations / overtime approval -> payrollRuntime -> payrollCalculator -> payroll validation/readiness -> GraphQL attendance documents -> staff schedule action`.

## Smallest root fixes

- Override `upsertStaffAttendance` in the existing protected mutation wrapper; do not duplicate the full resolver.
- Keep both canonical attendance timestamps and legacy aliases in the output type while current screens migrate.
- Replace the duplicate Timesheet aggregate in payroll runtime with one in-memory aggregation over the already-fetched rows. This makes timestamp, approval, night-window, and day classification use one source.
- Change validation/readiness filters so only unresolved overtime blocks payroll; `rejected` is a terminal zero-pay state.

## Payable interval rules

### Scheduled attendance

- Regular interval: intersection of actual attendance with planned shift.
- Overtime interval: starts at planned end and is capped by actual checkout and approved overtime minutes.
- Early arrival does not create paid regular time.
- Pending/rejected overtime does not enter total payable hours.

### Approved off-schedule attendance

- The full actual interval is payable because there is no planned shift boundary.

### Classification

- Split approved overtime at local midnight using the payroll timezone offset.
- Holiday takes precedence over configured weekend, then weekday.
- Night minutes are the overlap of payable intervals with the configured night window.

## Validation

Target the existing attendance access and payroll correctness tests. Add cases for self-service bypass, rejected/partial overtime, exact night overlap, cross-midnight classification, and rejected-overtime payroll readiness.
