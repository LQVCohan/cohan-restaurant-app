# Staff performance policy modal

## Current behavior

The manager staff-performance page contains a static `<details>` block that explains the fixed 25/25/20/20/10 formula. The backend classifies scores with hard-coded thresholds (90/80/65/50). There is no restaurant-scoped policy API, persistence, audit trail, or configuration modal.

## Real flow

1. `SystemSetting` stores restaurant-scoped operational policies.
2. `staffPerformance.service.js` calculates component scores, weighted final score and `performanceLevel`.
3. Staff GraphQL resolvers expose snapshots and recalculation.
4. `useStaffPerformance` queries snapshots and runs review/recalculate mutations.
5. `StaffPerformancePage` renders filters, formula help, summary, table and review modal.

## Root cause

The calculation policy is split between hard-coded backend thresholds and static frontend copy. Adding a UI-only editor would create false configuration, while exposing every formula constant would allow managers to change protected business logic without sufficient controls.

## Scope

- Persist restaurant-specific performance level thresholds in the existing `SystemSetting` document.
- Add a dedicated performance-policy query and mutation guarded by restaurant access and manager-level roles.
- Allow editing only `excellentMin`, `goodMin`, `averageMin`, and `needsAttentionMin`.
- Keep weights, attendance penalties, quality role rules, correction penalty, incident/appeal behavior and score range read-only.
- Validate integer thresholds from 0 to 100 in strictly descending order.
- Use the configured thresholds when recalculating snapshots.
- Replace the static formula disclosure with a button that opens an accessible manager modal.
- Explain that saved thresholds affect newly recalculated snapshots and do not rewrite existing history.

## Out of scope

- Changing component weights.
- Changing attendance, quality, cashier, kitchen or compliance penalty constants.
- Automatically recalculating all historical snapshots after saving policy.
- Adding a separate database collection or UI dependency.
- Changing employee self-service performance pages.

## Acceptance criteria

1. A manager can open “Cấu hình đánh giá” from the performance page for a selected restaurant.
2. The modal shows the complete calculation overview and clearly marks editable vs locked rules.
3. Only the four classification thresholds are editable.
4. Invalid, non-integer or non-descending thresholds are rejected in both UI and backend.
5. Staff or users outside the restaurant scope cannot read or update the policy.
6. Saving persists the policy per restaurant and creates an audit log.
7. Recalculated snapshots use the configured thresholds for `performanceLevel`.
8. Existing snapshots remain unchanged until recalculated.
9. Modal supports Escape, backdrop close, visible focus, focus return and narrow mobile layouts.

## Validation plan

- `npx vitest run cohan-restaurant-backend/tests/services/staff-performance-policy.test.js`
- `npx vitest run src/components/Dashboard_Manager/Staff/components/Performance/StaffPerformancePage.policy.test.jsx`
- `npm run check:graphql`
- `npm run build`
- Manual keyboard and 390px/desktop browser smoke when a runnable checkout is available.
