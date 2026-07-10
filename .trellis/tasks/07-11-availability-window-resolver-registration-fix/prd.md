# AvailabilityWindow resolver registration fix

## Current behavior

Opening an availability registration period or reloading the schedule page fails with:

`Cannot return null for non-nullable field AvailabilityWindow.effectiveStatus.`

The manager availability panel and registered-availability modal both show the raw GraphQL error because the shared `availabilityWindows` query cannot serialize its result.

## End-to-end flow

`AvailabilityRegistrationWindow` model -> `availability.graphql` -> availability query/lifecycle mutation -> `availability/index.js` type resolver -> root `graphql/resolvers/index.js` -> `GET_AVAILABILITY_WINDOWS` in manager/staff schedule pages -> availability panel and modal.

## Root cause

- `AvailabilityWindow.effectiveStatus` and `AvailabilityWindow.registrationMode` are non-persisted GraphQL fields.
- `availability/index.js` already defines resolvers for both fields.
- The root resolver map registers `availability.Query` and `availability.Mutation` but omits `availability.AvailabilityWindow`.
- GraphQL therefore uses its default field resolver, reads missing document properties, and returns `null`.
- The first requested non-null field, `effectiveStatus`, aborts the entire query/mutation response.

## Scope

- Register the existing `AvailabilityWindow` type resolver in the executable root resolver map.
- Add one focused resolver-index test covering both computed fields.
- Preserve schema nullability, window lifecycle rules, restaurant access, roles, Apollo operations, and UI behavior.

## Files changing

- `cohan-restaurant-backend/graphql/resolvers/index.js`
- `cohan-restaurant-backend/tests/resolvers/availability-resolver-index.test.js`

## Acceptance criteria

- `resolvers.AvailabilityWindow.effectiveStatus` resolves a valid status for a window document.
- `resolvers.AvailabilityWindow.registrationMode` resolves the stored snapshot or `manual` fallback.
- Creating/opening an availability window can serialize the mutation result.
- Reloading manager and staff schedule pages can serialize `availabilityWindows` without the non-null error.
- No frontend workaround or schema relaxation is introduced.

## Validation

- `npm --prefix cohan-restaurant-backend test -- tests/resolvers/availability-resolver-index.test.js`
- `npm run check:graphql`
- Browser replay: open a registration period, reload `/manager#schedules`, and open registered availability.

## Out of scope

- Changing effective-status business rules.
- Changing registration dates or lifecycle transitions.
- Redesigning the schedule page or availability modal.
