# Availability employment rules

## Current behavior

The staff availability UI distinguishes weekly availability from unavailable exceptions, but the backend accepts `employmentType`, `submissionType`, slot data, and submission status from the client. The manager policy form also displays `lateChangeRequiresApproval` without persisting it.

## Root cause

The trust boundary is `submitStaffAvailability`: it does not load the canonical staff record for every submission and does not validate the submitted slot contract against the registration window and scheduling policy.

## Traced flow

1. `SchedulingPolicy` defines shift templates, employment-type rules, and availability registration policy.
2. `createAvailabilityWindow` snapshots target employment types and late-change behavior.
3. `submitStaffAvailability` stores employee submissions.
4. `StaffSchedulePage` uses the existing product rule: full-time reports unavailable exceptions; part-time, seasonal, probation, and contract submit weekly availability.
5. `staffAvailabilityContext.service.js` evaluates stored submissions when validating shift assignments.
6. Manager policy UI updates the scheduling policy.

## Files

- `cohan-restaurant-backend/graphql/resolvers/availability/mutation.js`: use canonical staff employment type and validate submission type, slots, dates, shift templates, duplicates, and minimum hours.
- `src/components/Dashboard_Manager/Schedule/hooks/useAvailabilityPolicyUpdate.js`: persist late-change approval configuration.
- `cohan-restaurant-backend/tests/resolvers/availability.resolver.test.js`: align existing resolver cases with canonical staff lookup.
- `cohan-restaurant-backend/tests/resolvers/availability-access-consistency.test.js`: preserve owner, manager, and restaurant-scope coverage.
- `cohan-restaurant-backend/tests/resolvers/availability-employment-rules.test.js`: cover the new trust-boundary validation.

## Acceptance criteria

- Client-provided `employmentType` cannot override the staff record.
- The existing full-time versus part-time-like registration behavior remains compatible with the staff UI.
- Unavailable exceptions are accepted only when the window allows them.
- Slot dates must be inside the registration period, shift types must be enabled, duplicate slots are rejected, and slot status must match the submission type.
- Required weekly availability must meet the configured minimum hours.
- Client-provided submission status cannot directly approve or lock a submission.
- Late-change approval configuration is actually persisted.
- Existing role and restaurant guards remain unchanged.

## Out of scope

- Changing HR permissions.
- Reclassifying probation or contract employees; that requires a separate business decision and coordinated UI change.
- Enforcing weekly scheduling caps as availability caps; availability is not an assignment.
- Changing the manager's selected-week navigation behavior.

## Validation

```bash
cd cohan-restaurant-backend
npx vitest run tests/resolvers/availability-employment-rules.test.js tests/resolvers/availability.resolver.test.js tests/resolvers/availability-access-consistency.test.js tests/resolvers/shift-assignment-availability.test.js
cd ..
npm run check:graphql
npm run build
```
