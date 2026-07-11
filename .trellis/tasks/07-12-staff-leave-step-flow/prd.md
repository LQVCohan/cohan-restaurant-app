# Staff leave step flow

## Current behavior and root cause

- The staff leave page opens `LeaveRequestForm` in a modal, but the form renders employee selection, eight leave types, both date/session groups, the total-day summary, reason and footer at the same time.
- Self-service already knows the authenticated employee, so the disabled employee search/select adds height without adding a task.
- The page also uses a large hero plus three instructional cards, pushing the leave history below the fold.
- The shared form is also used by managers, so replacing the default layout would unnecessarily change the manager workflow.

## End-to-end flow

1. `models/leave-request.model.js` stores leave type, date/session range, requested days/hours, reason and status.
2. `staffResolverCompatibility.graphql` exposes `CreateLeaveRequestInput`.
3. `graphql/resolvers/staff/mutation.js#createLeaveRequest` resolves the authenticated employee, validates restaurant membership and calculates leave duration/payroll flags.
4. `useLeaveManagement` sends the existing mutation payload and refetches leave history.
5. `StaffLeavePage` opens the shared `LeaveRequestForm` in self-service mode.
6. `LeaveRequestForm` validates and submits all fields.
7. `staff-leave.spec.js` covers the browser flow.

## Direction

Compact self-service wizard using the existing green staff palette: one focused task per screen, visible three-step progress, back/continue controls, and a final review before submission.

## Acceptance criteria

- Staff self-service shows three sequential steps: leave type, date/session range, then reason/review.
- Only the current step content is rendered; the known employee selector is not shown in the self-service wizard.
- Continue is blocked by current-step validation and errors remain next to the affected input.
- Users can move backward without losing entered values.
- The final step shows selected leave type, date range and calculated duration before submission.
- Cancel and successful submit reset the wizard to step one.
- Manager leave creation keeps the existing non-wizard form.
- The page hero and static guidance consume less vertical space without removing leave statistics or history.
- Keyboard focus, 44px touch targets, mobile stacking and reduced-motion behavior remain supported.

## Constraints

- Reuse the existing form state, validation, mutation and styles.
- Add no dependency and do not change GraphQL/schema/backend behavior.
- Preserve existing field names and E2E-visible mutation payload.

## Out of scope

- Leave balance previews, attachments, editing/cancelling submitted requests, manager approval changes or backend business-rule changes.
