# Availability employment rules

## Current behavior

The staff availability flow distinguishes part-time and full-time in the UI, but the backend accepts `employmentType`, `submissionType`, and slot status directly from the client. `targetEmploymentTypes` is stored on the registration window without being enforced during submission. The manager policy form also displays `lateChangeRequiresApproval` but does not persist it.

## Root cause

The trust boundary is in `submitStaffAvailability`: it does not load the canonical staff record for every submission and does not validate the submitted slot contract against the window and scheduling policy. The scheduling validator also hard-codes several employment types as part-time-like instead of consistently using the policy/window.

## Traced flow

1. `SchedulingPolicy` defines shift templates, employment-type rules, and availability registration policy.
2. `createAvailabilityWindow` snapshots target employment types and late-change behavior.
3. `submitStaffAvailability` stores employee submissions.
4. `StaffSchedulePage` selects weekly availability versus unavailable exceptions.
5. `staffAvailabilityContext.service.js` evaluates submissions when validating shift assignments.
6. Manager policy UI updates the scheduling policy.

## Files

- `cohan-restaurant-backend/graphql/resolvers/availability/mutation.js`: use canonical staff employment type and validate submission/slots/minimum hours.
- `cohan-restaurant-backend/src/services/scheduling/staffAvailabilityContext.service.js`: decide required availability from policy/window instead of a hard-coded employment-type list.
- `src/components/Dashboard_Manager/Schedule/hooks/useAvailabilityPolicyUpdate.js`: persist late-change approval configuration.
- `cohan-restaurant-backend/tests/resolvers/availability.resolver.test.js`: cover canonical employment type and invalid submissions.

## Acceptance criteria

- Client-provided `employmentType` cannot override the staff record.
- Weekly availability is accepted only for employment types required by the window/policy.
- Unavailable exceptions are accepted only when the window allows them.
- Slot dates must be inside the registration period, shift types must be enabled, duplicate slots are rejected, and slot status must match the submission type.
- Required weekly availability must meet the configured minimum hours.
- Late-change approval configuration is actually persisted.
- Existing role and restaurant guards remain unchanged.

## Out of scope

- Changing HR permissions.
- Enforcing weekly scheduling caps as availability caps; availability is not an assignment.
- Changing the manager's selected-week navigation behavior.

## Validation

```bash
cd cohan-restaurant-backend
npx vitest run tests/resolvers/availability.resolver.test.js tests/resolvers/shift-assignment-availability.test.js
cd ..
npx vitest run src/components/Dashboard_Manager/Schedule/components/AvailabilityRegistrationPanel.test.jsx
npm run check:graphql
npm run build
```
