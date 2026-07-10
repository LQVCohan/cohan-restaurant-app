# Finance management upgrade

## Current behavior

- The dashboard sends a currency choice to GraphQL, but the resolver ignores it while every amount is still formatted as VND.
- Default month dates are built with `toISOString()`, which can shift to the previous day in UTC+7.
- Custom ranges can query with missing or reversed dates.
- Currency settings and CSV export are shown without matching frontend permissions.
- Reconciliation rows with status `resolved` are queried but dropped from the summary.
- The filter toolbar is dense and weak on mobile.

## Scope

Trace and repair the finance dashboard flow:

`payments.graphql -> payment/query.js -> useFinance.js/useRestaurantCurrency.js -> FinanceDashboard/FinanceComponents -> manager navigation -> tests`.

## Acceptance criteria

- Finance data stays canonical in VND and VND/USD display uses the existing currency utility and restaurant exchange rate.
- Month boundaries use local calendar dates.
- Custom ranges require both dates and reject `from > to` in UI and backend.
- Export and restaurant currency persistence respect existing permissions.
- Refresh/export controls cannot run without a restaurant or while invalid/loading.
- Resolved reconciliations are included in the handled reconciliation total.
- Drill-down actions keep the existing manager navigation contract.
- Layout remains readable on desktop and at 390px/430px widths.
- Targeted frontend/backend tests cover the changed logic.

## Out of scope

- Changing stored money values or database currency representation.
- Rebuilding transaction management.
- Adding chart or design dependencies.
- Changing finance permissions or role seeds.
