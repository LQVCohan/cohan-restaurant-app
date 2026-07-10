# Implementation plan

1. Update `useFinance.js` with local date helpers, active restaurant initialization, custom-range validation and query skipping.
2. Update `payment/query.js` with matching trust-boundary validation and handled reconciliation counting.
3. Update finance components to accept a shared money formatter and improve chart/status accessibility.
4. Update the dashboard controls, permissions, currency persistence error handling, CSV output and responsive information hierarchy.
5. Extend the existing priority stylesheet; do not add a dependency or a fourth finance stylesheet.
6. Add targeted tests for local date/range behavior, dashboard interactions and resolver validation.

## Validation

- `vitest run src/hooks/useFinance.test.js src/components/Dashboard_Manager/Finance/FinanceDashboard.test.jsx`
- `npm --prefix cohan-restaurant-backend test -- tests/finance/finance-dashboard.test.js`
- `npm run check:graphql`
- `npm run build`

When runtime execution is unavailable, verify current file syntax/contracts through repository inspection and report that commands were not run.
