# Implementation summary

## Backend

- Added `timeFrom` to the `TableCustomer` Mongoose model and GraphQL type/input.
- Updated the existing upsert resolver to persist explicit `timeFrom` values while preserving the stored value for legacy callers that omit the field.
- Kept existing restaurant access checks, table lookup, available-to-reserved transition, and realtime event behavior.

## Frontend

- Requested and submitted both `timeFrom` and `timeTo` in `TableActionsModal`.
- Fixed reservation-result unwrapping so `{ success: true, data: null }` is treated as no active reservation.
- Restored persisted customer identity, party size, date, arrival time, end time, and note when reopening the modal.
- Kept an actual active Reservation authoritative over the snapshot.
- Awaited `onUpdated` after customer persistence so POS refetches the table list immediately.
- Added visible field labels, capacity guidance, an explicit party-size control, clearer schedule wording, and responsive spacing.

## Regression coverage added

- Backend resolver test for both schedule timestamps and legacy omission of `timeFrom`.
- Frontend modal test for reopening a reserved table without an active Reservation and for post-save table refresh.

## Validation status

The connected environment has no repository checkout or installed dependencies and cannot resolve `github.com`, so the targeted Vitest suites, GraphQL schema check, frontend build, and browser smoke test were not run here.
