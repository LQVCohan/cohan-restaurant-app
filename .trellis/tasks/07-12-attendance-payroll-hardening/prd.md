# Attendance & Payroll Hardening

## Current behavior

- `upsertStaffAttendance` accepts self-service staff calls and client-supplied timestamps, while the canonical staff flow is `checkInShift` / `checkOutShift` against a published shift.
- `StaffSchedulePage` asks for `checkInAt` / `checkOutAt`, but the canonical attendance type only declares `actualCheckInAt` / `actualCheckOutAt`.
- Payroll sums stored `hours`, so overtime that is pending or rejected can remain inside regular hourly pay.
- Night overtime uses the whole shift's night overlap instead of the approved overtime interval.
- Payroll validation treats rejected overtime as unresolved.

## Required behavior

1. Self-service staff must use shift-bound check-in/check-out. Manager quick attendance remains restaurant-scoped.
2. The GraphQL attendance contract must validate current staff operations.
3. Payable hours are regular in-shift minutes plus approved overtime minutes only.
4. Approved overtime is split by the actual local calendar segment (weekday/weekend/holiday).
5. Night premiums are calculated only for payable intervals that overlap the configured night window.
6. Rejected overtime is resolved with zero payable overtime and does not block payroll finalization.

## Constraints

- Preserve BrandMembership restaurant scope, payroll locks, roles, audit behavior, and existing UI operations.
- Do not add dependencies or a second payroll calculator.
- Keep finalized payroll snapshots immutable unless an explicit recalculation is requested.

## Acceptance criteria

- A STAFF actor cannot call manager quick attendance for their own employee id.
- Existing `myShiftAttendances` GraphQL document validates.
- Pending/rejected overtime is not paid as regular hourly work.
- Partial approved overtime pays only approved minutes.
- An overtime interval outside the night window gets no night overtime premium.
- A cross-midnight overtime interval is classified by each local calendar segment.
- Rejected overtime does not produce `UNAPPROVED_OVERTIME` / readiness blockers.
