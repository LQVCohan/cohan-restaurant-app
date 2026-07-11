# Implementation plan

## Steps

1. Reset Header, Sidebar and account-center UI state from the authenticated account ID.
2. Switch the shared manager restaurant selector to the live full-brand query already refetched by branch creation.
3. Persist sidebar destinations synchronously and cover hash/local-storage behavior.
4. Add a manager menu catalog modal and expose it only on the menu page.
5. Review the final diff for duplicated state, GraphQL contract drift, permission gaps and unintended files.

## CI follow-up

The changed-component run exposed two existing Payroll test failures:

- the payroll page and readiness panel both expose a button named `Làm mới`, so the page test cannot target the intended action accessibly;
- the readiness test expects runtime-preview copy while its fixture already contains an official payroll period.

Files changed for the follow-up:

- `src/components/Dashboard_Manager/PayrollPage/PayrollManagement.jsx` — give the page-level refresh action a specific accessible name;
- `src/components/Dashboard_Manager/PayrollPage/PayrollManagement.test.jsx` — select that page-level action explicitly;
- `src/components/Dashboard_Manager/PayrollPage/PayrollManagement.readiness.test.jsx` — keep the test focused on readiness instead of contradictory runtime-mode copy.

## Validation

```bash
npx vitest run \
  src/components/Dashboard_Manager/Header.account-switch.test.jsx \
  src/hooks/useManagerRestaurantSelection.test.jsx \
  src/components/Dashboard_Manager/Sidebar.test.jsx \
  src/components/Dashboard_Manager/Menu/ManagerMenuCatalogModal.test.jsx \
  src/components/Dashboard_Manager/PayrollPage/PayrollManagement.test.jsx \
  src/components/Dashboard_Manager/PayrollPage/PayrollManagement.readiness.test.jsx
npm run check:graphql
npm run check:conflicts
npm run build
```

If a runnable checkout is unavailable, use the pull-request CI run and record every skipped check.