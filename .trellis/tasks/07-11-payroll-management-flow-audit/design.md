# Design

## Direction

Fix the shared calculation, scope and page boundaries instead of adding caller-specific patches. Reuse active restaurant-membership helpers, persisted payroll fields and existing Apollo queries. Keep all legal policy values and readiness rules unchanged.

## Compensation calculation

`buildPayrollItem` will normalize `salaryType` and calculate regular income as follows:

- `monthly`: current monthly proration by payable workdays;
- `hourly`: normal payable hours × `hourlyRate`, with approved overtime hours excluded from normal hours and then paid at existing overtime multipliers;
- `shift`: payable completed timesheet count × `baseSalary`, treating `baseSalary` as the persisted per-shift rate because no separate shift-rate field exists;
- `commission`: persisted timesheet `amount`, falling back to `wage`, as the commission source already available in payroll aggregation.

Paid-leave hours/units are included where appropriate. `allowanceAmount` becomes the employee-level allowance and is then combined once with restaurant defaults and manual adjustments. Insurance, tax, overtime and night rates continue using existing policy/configuration values.

## Staff and period scope

Both runtime calculation and readiness validation will use `getStaffMembershipRestaurantFilter`. Validation will compare each period item against the scoped staff set. Draft recalculation will delete items not present in the newly calculated employee set before reading final period stats.

`staffPayrollOverview` will reject a supplied `restaurantId` that does not match the resolved period.

## Time boundaries

Payroll-only start/end helpers will use UTC day boundaries, matching stored `workDate` calendar keys and current UI DateTime values. Shift queries will use overlap semantics: `startTime <= periodEnd` and `endTime >= periodStart`.

## Payment summaries

Summary totals will use each item's persisted `paidAmount`, clamped to its `netSalary`. A fully paid legacy item without a populated amount still falls back to full net salary. Remaining and progress are clamped to valid ranges.

## Manager UI

- Period/settings/overview queries wait for explicit restaurant scope.
- Changing restaurant clears the selected period.
- Official mode derives from the selected period, not visible filtered rows.
- Refresh normalizes its optional period argument so click events cannot become GraphQL IDs.
- Official CSV refetches `payrollExportRows` and maps the entire period to the existing CSV columns.
- Recalculate/finalize/lock buttons follow the current period status.

## Tests

- Pure calculation tests for all salary types, overtime and allowance.
- Summary test for partial payments.
- Runtime boundary helpers and stale-item behavior where practical with focused mocks.
- Resolver mismatch test.
- Hook skip test.
- Manager page refresh, restaurant change and full export tests.
