# Reject incomplete automatic schedules

## Current behavior

The backend blocks automatic schedule application when the selected scope still contains unresolved shifts or unfilled roles unless `allowPartialApply` is true. The manager page always sends `allowPartialApply: true`, so incomplete schedules can be applied without a separate, audited product flow.

## Root cause

The shared completeness guard trusts a client-controlled bypass flag. This makes the safe default dependent on every caller remembering not to send that flag.

## End-to-end flow

1. `AutoScheduleModal` prepares the preview and selected shifts.
2. `ScheduleManagement.handleApplyAutoSchedule` sends the mutation input, including the legacy partial flag.
3. The staff mutation delegates to `buildAutoScheduleCreateInputs`.
4. `assertPreviewCanApply` must remain authoritative for every caller.

## Files to change

- `cohan-restaurant-backend/src/services/scheduling/autoSchedule.service.js`: remove the client-controlled completeness bypass.
- `cohan-restaurant-backend/tests/services/auto-schedule-hardening.test.js`: prove unresolved roles stay blocked even when the legacy flag is sent.

## Acceptance criteria

- A preview with unresolved shifts or roles is rejected before any create-shift input is returned.
- Sending `allowPartialApply: true` does not bypass the guard.
- Complete selected scopes still return their validated assignments.
- Override rules for availability/overtime remain unchanged.
- GraphQL schema, resolver authorization, and frontend code remain unchanged.

## Out of scope

- A new explicitly confirmed partial-application product flow.
- Changing assignment heuristics.
- Changing override rules for availability or overtime.
- Changing publication validation.

## Validation plan

- Run the focused auto-schedule hardening test.
- Run backend lint, tests, and build through CI.
- Run frontend contract, build, and smoke checks through CI.
