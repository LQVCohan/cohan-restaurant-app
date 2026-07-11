# Implementation result

## Runtime files

1. `cohan-restaurant-backend/src/services/payroll/payrollCalculator.service.js`
   - normalizes `salaryType`;
   - calculates monthly, hourly, per-shift and commission income from the persisted compensation profile;
   - excludes approved overtime from hourly regular hours before applying the existing overtime multipliers;
   - includes the employee-level allowance exactly once;
   - preserves the configured insurance, tax, night-work and minimum-wage policy values.
2. `cohan-restaurant-backend/src/services/payroll/payrollRuntime.service.js`
   - loads employees through the active brand-membership restaurant scope;
   - includes salary type, hourly rate and employee allowance in the source snapshot;
   - uses UTC-stable payroll day boundaries and overlapping-shift queries;
   - aggregates eligible timesheets, approved overtime, paid leave and adjustments consistently;
   - removes obsolete payroll items during editable draft recalculation;
   - includes partial payments in paid, remaining and progress totals;
   - keeps finalized/paying/paid/locked periods on their saved settings snapshot.
3. `cohan-restaurant-backend/src/services/payroll/payrollValidation.service.js`
   - validates the same scoped staff roster used by calculation;
   - validates the compensation rate required by each salary type;
   - reports missing or stale payroll items and cross-restaurant adjustments;
   - retains existing attendance, leave, overtime, minimum-wage and negative-net guards.
4. `cohan-restaurant-backend/graphql/resolvers/staff/payrollOverviewScope.query.js`
   - wraps the existing direct and paginated overview resolvers;
   - resolves the actual period restaurant and rejects `periodId`/`restaurantId` mismatches before delegation.
5. `cohan-restaurant-backend/graphql/resolvers/index.js`
   - composes the scoped payroll overview wrappers without duplicating the existing query/pagination implementation.
6. `cohan-restaurant-backend/src/services/payroll/payrollPayment.service.js`
   - executes one salary payment as a Mongoose transaction;
   - rechecks the remaining salary inside the transaction;
   - writes payment, cashflow, payroll item and optional period summary atomically;
   - rejects overpayment and concurrent item-write conflicts;
   - validates idempotency keys/payout IDs against the same period, employee and payroll item;
   - returns the stored result for a valid repeated idempotent request.
7. `src/components/Dashboard_Manager/PayrollPage/PayrollManagement.jsx`
   - mounts payroll queries only after a restaurant is selected;
   - resets local payroll state when the selected restaurant changes;
   - derives official/runtime mode from the selected period rather than filtered rows;
   - prevents click events from being passed as period IDs during refresh;
   - exports every row from an official period instead of only the visible page;
   - restricts recalculate/finalize/lock actions to valid period states and rejects empty mutation responses.

## Test files

1. `cohan-restaurant-backend/tests/services/payroll-calculation-integrity.test.js`
   - monthly/hourly/shift/commission calculation, allowance, overtime de-duplication, partial totals and UTC boundaries.
2. `cohan-restaurant-backend/tests/services/payroll-correctness.test.js`
   - membership roster, paid-leave behavior, approved overtime/night classification, overlapping shifts and readiness scope checks.
3. `cohan-restaurant-backend/tests/resolvers/payroll-overview-scope.test.js`
   - period/restaurant mismatch and wrapper delegation.
4. `cohan-restaurant-backend/tests/services/payroll-payment-transaction.test.js`
   - atomic payment/cashflow/item writes, overpayment, idempotent replay and idempotency conflict.
5. `cohan-restaurant-backend/tests/services/payroll-payment-workflow.test.js`
   - payslip, period-state guards, batch partial success, history sorting and export compatibility with transactions.
6. `src/components/Dashboard_Manager/PayrollPage/PayrollManagement.test.jsx`
   - selected-restaurant guard, pagination/filtering, safe refresh, full official export, period creation and lifecycle actions.

## Audited unchanged flows

- GraphQL payroll schema and operation names;
- payroll permission and restaurant-access checks;
- finalization readiness gate;
- approved overtime policy multipliers;
- insurance, tax, minimum-wage and night-work policy values;
- bank-account and payout-provider integrations;
- finalized, paid and locked snapshot edit restrictions.

## Validation record

- Reviewed the active model → resolver/service → hook → manager UI flow and all direct callers of the changed payroll services.
- Re-fetched every changed runtime file from `main` after the writes and reviewed the final composed implementations.
- Added focused regression tests for each confirmed defect and aligned the existing payroll correctness/payment tests with the new contracts.
- GitHub did not attach a workflow run or commit status to the payroll implementation commits at review time.
- Vitest, GraphQL validation, integration tests and the Vite production build were not executed because the GitHub connector does not provide a runnable checkout in this session.

## Review checklist

- No GraphQL schema or database migration.
- No statutory or configured policy-rate changes.
- No readiness or permission bypass.
- No mutation of finalized/paid/locked snapshots through recalculation.
- No new dependency or duplicate data-fetching layer.
