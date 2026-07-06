# Schedule manager declined acknowledgement fix and UI polish

## Current behavior

The manager schedule page creates a declined-shift acknowledgement query with the lowercase value `declined`. The GraphQL variable type is `ShiftAcknowledgementStatus`, whose valid values are uppercase enum literals. GraphQL rejects the request before the staff query resolver runs, and the rejected request produces the validation message seen in the manager panel.

The visual workspace also loads several late warm-tone style layers. On wide screens the schedule remains narrower than necessary, the page canvas is beige, and the declined-review filters lack clear spacing and hierarchy.

## Root cause

The end-to-end flow is:

1. `staffResolverCompatibility.graphql` declares `ShiftAcknowledgementStatus` as `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, and `CANCELLED`.
2. GraphQL validates variables before entering the resolver.
3. The staff query resolver accepts the validated enum and normalizes it to lowercase for the Mongoose filter.
4. A schedule caller supplies `status: "declined"`, so validation fails before resolver normalization.
5. The visual warmth comes from late schedule styles such as `schedule-color-final-refinement.css`, which restore cream surfaces after the manager shell styles.

## Implementation

- Normalize only the `status` variable of the `ShiftAcknowledgements` operation at the shared Apollo transport boundary.
- Convert string values to uppercase before the HTTP link serializes the request.
- Leave unrelated operations and variables unchanged.
- Keep the GraphQL schema, resolver normalization, MongoDB query, permissions, and schedule business flow unchanged.
- Add a final page-scoped cool sage layer after all existing schedule CSS.
- Widen the weekly workspace on large screens and improve day-column, shift-card, toolbar, KPI, availability, and declined-review readability.
- Preserve warning, danger, and status semantics.

## Files changed

- `src/apollo/client.js`: add the schedule acknowledgement enum compatibility link at the outbound GraphQL boundary.
- `src/apollo/client.scheduleVariables.test.js`: cover lowercase-to-uppercase normalization and unrelated-operation passthrough.
- `src/components/Dashboard_Manager/Schedule/ScheduleManagementPage.jsx`: load the final schedule theme last.
- `src/styles/schedule-manager-sage-upgrade.css`: final page-scoped cool neutral and sage visual layer.

## Acceptance criteria

- A `ShiftAcknowledgements` request created with `status: "declined"` reaches the HTTP link as `status: "DECLINED"`.
- The GraphQL enum validation error shown in the screenshot no longer occurs.
- Other GraphQL operations are not modified by the compatibility link.
- The schedule canvas has no cream/beige base surface.
- Weekly columns use more available desktop width and remain horizontally usable on smaller screens.
- Schedule cards stay mostly white; sage is used as an accent rather than a full-card fill.
- Declined-review filter controls have visible spacing and active styling.
- Existing schedule creation, publication, attendance, availability, and review behavior is unchanged.

## Validation

- Added a focused Vitest regression test for enum normalization.
- Re-fetched the changed files and checked link ordering and final CSS import ordering.
- The targeted test and Vite production build could not be run in the connector-only environment.
- No GitHub status checks were available at the time of review.
