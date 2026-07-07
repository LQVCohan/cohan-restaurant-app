# Forecast the selected scheduling period

## Current behavior

The schedule page sends the selected `periodStart` and `periodEnd` to `aiSchedulePlannerPreview`. The planner forwards that range to `buildStaffSchedulingAssistant`, but the assistant calls `buildDemandForecast` with only `horizonDays`. `buildDemandForecast` always generates dates from the current time and queries reservations from the current time, so a future selected week can be filtered out and replaced by fallback demand.

## Root cause

The shared demand forecast service has no optional forecast anchor. The selected schedule period stops at the scheduling assistant boundary instead of reaching the service that generates forecast dates and loads matching reservations.

## End-to-end flow

1. `ScheduleManagement.jsx` sends the selected schedule period in `AiSchedulePlannerPreviewInput`.
2. The staff GraphQL resolver calls `buildAiSchedulePlannerPreview`.
3. `buildAiSchedulePlannerPreview` passes the period to `buildStaffSchedulingAssistant`.
4. `buildStaffSchedulingAssistant` must pass the selected start to `buildDemandForecast`.
5. `buildDemandForecast` must generate dates and query reservations from that anchor while keeping order history relative to the real current time.

## Files to change

- `cohan-restaurant-backend/src/services/ai/demandForecast.service.js`: accept an optional `forecastStart`, anchor generated dates to it, and query reservations for the anchored horizon.
- `cohan-restaurant-backend/src/services/ai/staffSchedulingAssistant.service.js`: forward the selected period start to the demand forecast service.
- `cohan-restaurant-backend/tests/analytics/demand-forecast-selected-period.test.js`: prove forecast dates start at the requested anchor.
- `cohan-restaurant-backend/tests/analytics/staff-scheduling-selected-period.test.js`: prove the scheduling assistant forwards the selected start and keeps forecast output instead of falling back.

## Acceptance criteria

- A future week selected on the schedule page produces forecast rows for that week.
- Reservations are loaded from the requested forecast period, not only from today.
- Calls that omit `forecastStart` keep the existing current-date behavior.
- Historical order lookback and rising-dish calculations remain relative to the actual current time.
- No GraphQL schema, resolver authorization, frontend query, or UI change is introduced.

## Out of scope

- Availability fail-open behavior.
- Partial auto-schedule application.
- Empty-day normalization and past-hour filtering.
- Occupancy heatmap or staff-performance implementation.

## Validation plan

- Run the two focused Vitest files.
- Run backend lint and GraphQL checks through CI.
- Run the backend build through CI.
