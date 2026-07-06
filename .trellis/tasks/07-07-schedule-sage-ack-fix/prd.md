# Schedule manager declined acknowledgement fix and UI polish

## Current behavior

The manager schedule page queries declined shift acknowledgements with the lowercase variable value `declined`. The GraphQL variable type is `ShiftAcknowledgementStatus`, whose valid values are uppercase enum literals. GraphQL rejects the request before the staff query resolver runs, and the page prints the full validation message inside the declined-shift review panel.

The visual workspace also loads several late warm-tone style layers. On wide screens the schedule remains narrower than necessary, the page canvas is beige, and the declined-review filters and error state lack clear spacing and hierarchy.

## Root cause

The end-to-end flow is:

1. `staffResolverCompatibility.graphql` declares `ShiftAcknowledgementStatus` as `PENDING`, `ACCEPTED`, `DECLINED`, `EXPIRED`, and `CANCELLED`.
2. GraphQL validates variables before entering the resolver.
3. The staff query resolver accepts the validated enum and normalizes it to lowercase for the Mongoose filter.
4. `ScheduleManagement.jsx` currently sends `status: "declined"`, so validation fails before resolver normalization.
5. The component then renders the raw GraphQL validation message.

The visual warmth comes from late schedule styles such as `schedule-color-final-refinement.css`, which intentionally restore cream surfaces after the manager shell styles.

## Scope

- Send the valid uppercase GraphQL enum value `DECLINED`.
- Keep resolver and database normalization unchanged.
- Replace raw declined-query errors with concise user-facing copy and a retry action.
- Mark the declined-review filters as pressed controls for keyboard and assistive-technology users.
- Add a final page-scoped cool sage layer after existing schedule CSS.
- Widen the weekly workspace on large screens and improve day-column, shift-card, toolbar, KPI, and declined-review readability.
- Preserve warning, danger, and status semantics.

## Files to change

- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`: enum variable, friendly error state, retry action, filter accessibility.
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.test.jsx`: regression assertions for uppercase enum and non-raw error UI.
- `src/components/Dashboard_Manager/Schedule/ScheduleManagementPage.jsx`: load the final schedule theme last.
- `src/styles/schedule-manager-sage-upgrade.css`: final page-scoped visual layer.

## Acceptance criteria

- The declined acknowledgement query sends `status: "DECLINED"`.
- The GraphQL enum validation error shown in the screenshot no longer occurs.
- Unexpected declined-query failures do not expose raw GraphQL details.
- The error state offers a retry button.
- Declined-review filter buttons expose `aria-pressed`.
- The schedule canvas has no cream/beige base surface.
- Weekly columns use more available desktop width and remain horizontally usable on smaller screens.
- Schedule cards stay mostly white; sage is used as an accent rather than a full-card fill.
- Existing schedule creation, publication, attendance, availability, and review behavior is unchanged.

## Validation plan

- Run the targeted `ScheduleManagement.test.jsx` suite.
- Run the Vite production build when a runnable checkout is available.
- Verify desktop schedule, declined-query error state, and mobile horizontal scrolling visually.
- State any checks that cannot be run.
