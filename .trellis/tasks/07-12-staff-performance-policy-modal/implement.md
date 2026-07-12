# Implementation result

## Root cause confirmed

The manager performance page had only a static formula disclosure. Classification thresholds were hard-coded in backend calculation and frontend formatting, with no restaurant-scoped persistence, authorization boundary, audit trail, or safe configuration contract.

## Runtime changes

1. `cohan-restaurant-backend/models/system-setting.model.js`
   - stores restaurant-specific performance level thresholds under `performancePolicy.levelThresholds`;
   - defaults to 90/80/65/50 for existing restaurants without saved configuration.
2. `cohan-restaurant-backend/src/services/staffPerformance/staffPerformancePolicy.service.js`
   - exposes the fixed component weights and full locked calculation explanation;
   - validates four editable integer thresholds in strictly descending order;
   - restricts policy access to ADMIN, MANAGER and HR;
   - reads and updates the policy in `SystemSetting`;
   - writes a before/after audit log;
   - applies the saved thresholds to newly recalculated snapshots and stores the policy used in snapshot factors.
3. `cohan-restaurant-backend/graphql/schema/staffPerformancePolicy.graphql`
   - adds the dedicated policy query and update mutation;
   - mutation input exposes only the four classification thresholds, so weights and penalty constants cannot be changed through GraphQL.
4. `cohan-restaurant-backend/graphql/schema/index.js`
   - registers the new schema extension.
5. `cohan-restaurant-backend/graphql/resolvers/staffPerformancePolicy/index.js`
   - enforces authentication and restaurant scope for policy reads, writes and performance recalculation;
   - wraps the existing recalculation resolver without duplicating the core performance formula.
6. `cohan-restaurant-backend/graphql/resolvers/index.js`
   - composes policy queries/mutations and the scoped recalculation wrapper.
7. `src/hooks/useStaffPerformancePolicy.js`
   - loads and updates the policy for the selected restaurant.
8. `src/utils/staffPerformanceGlobalFormat.js`
   - uses the active restaurant thresholds when rendering manager performance labels.
9. `src/components/Dashboard_Manager/Staff/components/Performance/StaffPerformancePolicyPage.jsx`
   - adds the manager policy launcher and accessible modal;
   - shows fixed formula weights and exact locked rules;
   - permits editing only the four classification thresholds;
   - previews the resulting score bands and blocks invalid ordering;
   - explains that saving does not rewrite historical snapshots and requires recalculation for new classification;
   - closes through Escape, backdrop or close button, traps focus and restores focus.
10. `src/components/Dashboard_Manager/Staff/components/Performance/StaffPerformancePolicyPage.scss`
    - adds responsive desktop/mobile modal layout, visible focus states, 44px controls and reduced-motion handling;
    - hides the previous static formula disclosure only within the new manager wrapper.
11. `src/components/Dashboard_Manager/Staff/components/Performance/index.js`
    - mounts the policy-enabled wrapper while keeping the original performance page implementation intact.

## Guard rails

### Editable

- Excellent minimum score.
- Good minimum score.
- Average minimum score.
- Needs-attention minimum score.

### Locked

- Weights: Productivity 25%, Punctuality 25%, Quality 20%, Manager Review 20%, Compliance 10%.
- Productivity formula and order-count reference behavior.
- Attendance penalties for late arrival, early departure and absence.
- Role-aware Quality evidence and penalties.
- Manager review source and neutral fallback.
- Compliance correction-request penalty.
- Incident, appeal and final score clamping behavior.

## Regression coverage added

1. `cohan-restaurant-backend/tests/services/staff-performance-policy.test.js`
   - defaults, role guard, threshold validation, persistence, protected-field exclusion, audit and recalculation classification.
2. `cohan-restaurant-backend/tests/graphql/staff-performance-policy-schema.test.js`
   - policy operations compile and protected weights are absent from mutation input.
3. `cohan-restaurant-backend/tests/resolvers/staff-performance-policy.resolver.test.js`
   - authentication, restaurant scope and recalculation wrapper ordering.
4. `src/components/Dashboard_Manager/Staff/components/Performance/StaffPerformancePage.policy.test.jsx`
   - selected-restaurant guard, modal disclosure, invalid ordering and save payload.

## Validation record

- Re-fetched the active schema, resolver, service, hook, page entry and caller before updating.
- Reviewed the final resolver composition and the selected-restaurant props from `StaffManagement.jsx`.
- Vitest, GraphQL schema validation, production build and browser smoke were not executed because the GitHub connector does not provide a runnable checkout in this session.
- No database migration is required because the policy is an optional nested field with defaults in the existing restaurant `SystemSetting` document.
