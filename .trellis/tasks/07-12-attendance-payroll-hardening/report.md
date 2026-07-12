# Implementation report

## Delivered

- Staff self-service can no longer call manager quick attendance with a client-controlled timestamp. Staff must use the published-shift `checkInShift` / `checkOutShift` flow.
- Current staff schedule GraphQL operations are compatible with `StaffAttendanceRecord` through `checkInAt` / `checkOutAt` aliases while canonical actual timestamps remain available.
- Payroll derives payable scheduled time from the intersection of actual attendance and the assigned shift, then adds only approved overtime minutes.
- Rejected or pending overtime is not paid as ordinary hourly work.
- Approved overtime is split at the restaurant payroll timezone's local midnight and classified as holiday, weekend, or weekday for each segment.
- Night allowance and overtime-at-night premium use the exact payable interval overlap with the configured night window.
- Overtime completion trusts the persisted Timesheet for actual minutes and rejects client values that differ or exceed the recorded time.
- Rejecting an existing overtime request updates the linked Timesheet to the terminal `rejected` / zero-pay state and respects payroll-period locks.
- Payroll validation and readiness treat rejected overtime as resolved instead of blocking period finalization.

## Compatibility

- Existing manager attendance actions, restaurant scope checks, payroll locks, finalized payroll snapshots, and the current staff UI operations remain in place.
- Legacy Timesheets that lack planned timestamps recover their shift boundary from `shiftId`; if no shift can be recovered, stored hours are reduced by actual overtime and only approved overtime is added back.

## Regression coverage added

- Self-service quick timestamp bypass.
- Manager quick attendance delegation.
- Timesheet as overtime completion source of truth.
- Overtime rejection synchronization.
- Rejected and partially approved overtime pay.
- Exact night overtime overlap.
- Cross-midnight weekday/weekend split.
- Rejected overtime validation/readiness state.

## Validation status

- `node --check` completed for the locally reconstructed payroll runtime and payroll correctness test sources.
- Targeted Vitest suites, the full GraphQL operation validation suite, frontend/backend builds, and browser smoke tests were not run because the GitHub connector does not provide an executable repository checkout.
