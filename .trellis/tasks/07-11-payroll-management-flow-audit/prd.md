# Audit and harden payroll management flows

## Current behavior

Payroll combines staff assignment, schedules, attendance, leave, overtime approval, salary profiles, payroll settings, period snapshots, readiness validation, payments, payouts, exports and manager UI. The core permission and readiness layers are already present, but several shared boundaries still produce incomplete or misleading payroll data.

## Confirmed root causes

1. Payroll runtime and validation select staff through legacy `restaurantForStaff` instead of the active brand-membership scope used elsewhere in staff management.
2. `Staff.salaryType`, `hourlyRate` and `allowanceAmount` exist in the persisted profile, while `buildPayrollItem` always prorates `baseSalary` as monthly salary.
3. Recalculation upserts current employees but never removes obsolete draft payroll items.
4. Payroll summaries count paid salary only when an item is fully `paid`, ignoring stored partial `paidAmount`.
5. Payroll day boundaries use server-local `setHours`; results can change with deployment timezone. Shift counts also exclude shifts that overlap the period but begin before its start.
6. `staffPayrollOverview` accepts both `restaurantId` and `periodId`, but the period branch does not reject a restaurant mismatch.
7. The manager hook can request fallback payroll data before the restaurant selector resolves.
8. The page retains the old period when switching restaurants; refresh buttons pass a React event as `periodId`; official/runtime mode depends on visible rows; CSV exports only the current paginated page.

## End-to-end flow traced

1. `staff.model.js`, `timesheet.model.js`, payroll period/item/payment models define salary profile, attendance and snapshot/payment state.
2. Staff GraphQL SDL exposes payroll periods, details, readiness, settings, payments, payouts and exports.
3. Staff query/mutation resolvers enforce payroll permissions and restaurant access.
4. `payrollRuntime.service.js`, `payrollCalculator.service.js` and `payrollValidation.service.js` calculate and validate official/runtime payroll data.
5. Payment and payout services update item and period payment state.
6. `usePayroll.js` owns Apollo queries/mutations and `PayrollManagement.jsx` owns the manager page actions, filtering, pagination and CSV export.
7. Existing tests cover permissions, readiness, payment/payout wiring and manager pagination.

## Scope

- Use active staff membership scope for calculation and validation.
- Calculate monthly, hourly, per-shift and commission profiles from their persisted salary fields and payroll inputs without changing legal multipliers.
- Include employee allowance in payroll income.
- Remove obsolete items only while recalculating an editable draft period.
- Include partial payments in totals and progress.
- Make payroll date boundaries UTC-stable and count overlapping shifts.
- Reject period/restaurant mismatches at the resolver boundary.
- Prevent unscoped manager queries and stale period selection.
- Fix refresh, official-period labeling and full-period CSV export.
- Add focused regression tests.

## Acceptance criteria

- Staff assigned through the active brand membership appears in payroll even when the legacy field is absent.
- A staff member outside the selected restaurant cannot remain in a recalculated draft snapshot.
- Monthly, hourly, shift and commission profiles no longer all use the monthly formula.
- Hourly payroll uses normal hours plus approved overtime at configured multipliers without double-paying overtime hours.
- Personal allowance is included once.
- Partial salary payments update total paid, remaining and progress.
- Payroll boundaries return the same result regardless of server local timezone.
- A period from restaurant A cannot be rendered under restaurant B.
- Switching restaurant clears the old period.
- Refresh sends a real period ID, and official CSV contains the complete period rather than one page.

## Out of scope

- Changing statutory insurance, minimum wage, tax or overtime rates.
- Reworking readiness requirements, attendance approvals or payout provider integrations.
- Adding new salary-profile fields or GraphQL schema migrations.
- Redesigning the payroll page.
- Changing finalized, paid or locked payroll snapshots retrospectively.

## Validation plan

- Focused pure calculation/runtime tests.
- Resolver scope regression test.
- Hook query-scope tests.
- Manager page refresh/restaurant/export tests.
- Existing payroll resolver/service/component tests, GraphQL checks and build when the environment permits.
