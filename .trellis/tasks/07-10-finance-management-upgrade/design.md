# Design

## Root causes

1. `useFinance` owns a currency state that only causes a refetch; the backend dashboard is VND-based and ignores `input.currency`, while UI formatters hardcode VND.
2. Local calendar values are converted through UTC ISO strings.
3. Range validation exists neither in the hook nor at the resolver trust boundary.
4. Finance controls do not use the permission helper already used by transaction management.
5. Reconciliation aggregation includes `resolved`, but the returned summary only counts `matched`.
6. Three existing finance stylesheets layer overrides; the smallest safe UI change is to extend the final priority stylesheet rather than add another layer.

## Caller flow

- `ManagerLayout` allows the finance page for finance/payment readers.
- `FinanceDashboard` calls `useFinance` and `useRestaurantCurrency`.
- `useFinance` calls `financeDashboard(input)`.
- `PaymentQuery.financeDashboard` enforces finance read access and aggregates cashflows, invoices, payables, payments and reconciliations.
- Dashboard cards dispatch `manager:navigate`; `ManagerLayout` writes query/hash and `TransactionManagement` consumes `manager:navigation-query`.

## Minimal implementation

- Keep server values canonical in VND.
- Convert and format values only in the dashboard with `currency.js`.
- Pass one `formatMoney` function into finance child components.
- Expose a hook validation error and skip invalid custom queries.
- Repeat the range validation in the resolver.
- Use existing `hasAnyPermission` for export and restaurant-setting controls.
- Count resolved reconciliations as handled in the existing `matched` summary field to avoid schema churn; rename the UI label accordingly.
- Add focused CSS overrides and targeted tests only.
