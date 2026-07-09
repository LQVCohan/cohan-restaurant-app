# Reservation no-show contract fix

## Problem
FIND-003 reports that `deleteReservation` does not delete a reservation. The resolver marks it as `no_show`, releases the slot, and updates the table status. The customer orders page also exposes a `Xóa`/`Xóa lịch sử` action wired to this mutation, which is misleading and can fail for customers because the resolver requires staff/manager/admin reservation update permission.

## Flow traced
Mongoose/schema -> `reservation.graphql` exposes `deleteReservation(id: ID!)` -> `reservation/mutation.js` sets `current.status = "no_show"` -> customer `OrdersPage.jsx` defines `DELETE_RESERVATION` and shows `Xóa` for closed reservation history.

## Scope
- Keep existing backend behavior for compatibility.
- Add an explicit `markReservationNoShow` mutation name that matches the behavior.
- Deprecate `deleteReservation` in SDL instead of removing it.
- Remove the customer-side `Xóa lịch sử` action for reservations because customers should not mark no-show.

## CI follow-up
The backend seed script tests require `stderr` to stay empty. Mongoose emitted a duplicate `googleId` index warning because the field-level `unique/sparse` index and a separate `userSchema.index({ googleId: 1 })` declared the same index twice. The schema keeps the field-level index and removes the duplicate schema-level index instead of relaxing the tests.

## Out of scope
- Physical deletion of reservations.
- New customer hide-history feature.
- Data migration.

## Acceptance criteria
- Schema communicates that `deleteReservation` is legacy/deprecated.
- Staff/manager callers can use `markReservationNoShow` for the existing no-show behavior.
- Customer reservation history no longer presents a fake delete action.
- Backend script validation tests run without Mongoose duplicate index warnings.
