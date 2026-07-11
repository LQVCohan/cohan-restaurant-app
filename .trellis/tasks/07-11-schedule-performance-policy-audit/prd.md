# Schedule, payroll and performance policy audit

## Current behavior

The schedule manager uses an AI/backend preview and then applies selected assignments through the staff-shift mutation. The backend validates availability, leave, overlap, weekly hours, rest time, consecutive days, payroll locks and performance-based candidate scoring before creating a shift.

The performance snapshot formula currently uses fixed weights: Productivity 25%, Punctuality 25%, Quality 20%, Manager Review 20%, Compliance 10%. The base score is then followed by approved incident adjustments. Attendance, kitchen/bar, customer-rating and cashier evidence are role-aware and should only affect the relevant component when the evidence is sufficient.

## Findings

1. AiSchedulePlannerPreviewInput and ApplyAutoScheduleInput do not declare several fields sent by the current manager UI and consumed by the backend service. This can reject the preview/apply operation during GraphQL validation.
2. The UI description for Productivity refers to order volume/peer comparison, while the service calculates scheduled minutes versus actual worked minutes. Order count is reference data only.
3. The current role-aware Quality rules are not described clearly enough in the manager detail view and printed report.
4. Manager review stores overall, attitude, teamwork and skill values, but the current formula uses managerRatingScore for Manager Review and skillScore for Quality. Attitude/teamwork remain review context and are not independent weighted components.
5. Incident deductions are not automatic final deductions: a manager must review/mark responsibility/approve application. An accepted appeal reverses an applied deduction; the system does not award a general bonus.
6. Auto-schedule is a constrained heuristic that ranks candidates by role fit, availability, workload, employment type, cost, performance, reliability and risk penalties. It is not a guaranteed cyclic fair-rotation engine.
7. Payroll risk remains around UTC/local-day boundaries, cross-day shifts, off-schedule approval and approved overtime; this task does not change payroll calculation rules.

## Scope

- Add the fields required by the current AI preview/apply GraphQL operations.
- Add schema assertions that protect the contract from regression.
- Align manager, printed-report and backend fallback descriptions with the implemented scoring behavior.
- Explain role-specific Quality evidence and approved incident/appeal adjustments without changing the formula.

## Acceptance criteria

- AI schedule preview/apply operations validate against the backend schema with all fields currently sent by the manager UI.
- Productivity wording states that the score is based on actual worked minutes divided by scheduled minutes; order count is reference-only.
- The manager view and printed report explain the five weights, role-aware Quality evidence, and the conditions for deductions/reversals.
- Role descriptions cover order/service, cashier, head chef, assistant chef, and other roles according to the service implementation.
- Existing score weights and calculation behavior remain unchanged.

## Out of scope

- Replacing heuristic auto-scheduling with a cyclic rotation/optimization engine.
- Changing payroll rates, overtime multipliers, timezone storage, or attendance approval behavior.
- Changing the performance weights or making attitude/teamwork separate weighted components.
- Adding a new dependency or a new UI abstraction.

## Validation plan

- npm run check:graphql
- npm run check:conflicts
- npm run test:performance
- npm run build
