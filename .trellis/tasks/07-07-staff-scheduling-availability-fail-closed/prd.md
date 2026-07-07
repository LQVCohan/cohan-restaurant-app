# Fail closed when staff availability cannot be verified

## Current behavior

`buildStaffSchedulingAssistant` checks each candidate with `resolveStaffAvailabilityForShift`. A successful check can return availability issues, but an exception is converted to `availabilityIssues: []`. Hard-blocked candidates are only sorted later, not removed. As a result, a candidate whose availability is blocked or could not be verified can still appear under “Nhân sự có thể xếp ca”.

## Root cause

The shared candidate-selection boundary treats an availability infrastructure failure as a clean result and does not enforce the hard-block signal before taking the requested number of candidates.

## End-to-end flow

1. Availability window and submission data are resolved by `resolveStaffAvailabilityForShift`.
2. `buildStaffSchedulingAssistant` evaluates candidates and returns `suggestedCandidates`.
3. The staff scheduling GraphQL schema exposes those candidates and summary notes.
4. `useAnalyst` queries the result.
5. `StaffSchedulingAssistantWidget` displays the candidates as available for scheduling.

## Files to change

- `cohan-restaurant-backend/src/services/ai/staffSchedulingAssistant.service.js`: convert availability-check failures to a hard block, exclude all hard-blocked candidates, and add a summary warning when checks fail.
- `cohan-restaurant-backend/tests/analytics/staff-scheduling-assistant.test.js`: prove blocked and unverified candidates are not suggested.

## Acceptance criteria

- A candidate with `hardBlock: true` or severity `high` is never returned in `suggestedCandidates`.
- A candidate whose availability check throws is not returned in `suggestedCandidates`.
- The response summary states that some availability checks failed.
- Warning/risk availability issues that are explicitly overrideable remain ranked below clean candidates instead of being removed.
- GraphQL schema, resolver authorization, Apollo query, and UI markup remain unchanged.

## Out of scope

- Changing availability business rules or severity values.
- Adding retry infrastructure.
- Changing automatic schedule application.
- Changing frontend labels or layouts.

## Validation plan

- Run the focused Staff Scheduling Assistant test.
- Run backend lint and build through CI.
- Run repository frontend checks through CI to detect contract drift.
