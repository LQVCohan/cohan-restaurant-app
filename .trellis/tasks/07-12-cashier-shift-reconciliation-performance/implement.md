# Cashier shift reconciliation implementation

## Completed flow trace

`CashierShiftReconciliation model -> cashier reconciliation lifecycle/calculation service -> guarded GraphQL query/mutations -> Apollo reconciliation hook -> staff performance operations launcher/modal -> cashier performance enrichment -> performance policy classification -> persisted StaffPerformanceSnapshot`.

## Implemented

1. Added a dedicated cashier drawer reconciliation model with OPEN, SUBMITTED, APPROVED, WAIVED and REJECTED states, auditable cash movements, source IDs, counted cash, manager adjustment and responsibility decision.
2. Prevented overlapping active drawers for the same restaurant/cashier and released the unique active key only after a terminal review decision.
3. Added restaurant, actor, cashier-role, optional shift/timesheet and lifecycle guards.
4. Calculated expected cash from opening cash, successful cashier-attributed cash payments, successful cash refunds, explicit cash-in/cash-out movements and audited manager adjustment.
5. Added GraphQL operations for listing, opening, movement entry, refreshing, submitting and reviewing cashier shifts.
6. Corrected cashier performance evidence to use PaymentTransaction, PaymentRefund and Invoice data instead of order count/status approximations.
7. Limited cash variance scoring to APPROVED reconciliations explicitly marked attributable to the cashier; provider/bank callback errors remain excluded unless cashier attribution is explicit.
8. Recomputed cashier Quality, weighted formula, final score and level after normal performance recalculation, and refreshed overlapping saved snapshots immediately after manager review.
9. Added a responsive, keyboard-accessible manager modal from the staff performance page for the complete open-to-review workflow.
10. Added focused model, calculation, snapshot refresh, GraphQL schema and component tests.

## Validation

GitHub Actions CI run `8996` passed on code head `583103daaadc2045cd56fd7277ef5f40f9b44ec7`:

- backend lint: passed;
- backend tests: passed;
- backend Menu RBAC: passed;
- backend build: passed;
- conflict marker check: passed;
- frontend lint: passed;
- frontend unit tests: passed;
- frontend Menu RBAC: passed;
- changed component tests: passed;
- frontend build: passed;
- Playwright browser setup: passed;
- frontend smoke tests: passed.

The workflow intentionally skipped the optional full component suite after the changed-component suite passed. No manual browser screenshot review was run in this connector-only environment.
