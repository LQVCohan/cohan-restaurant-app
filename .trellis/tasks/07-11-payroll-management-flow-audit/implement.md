# Implementation plan

## Runtime files

1. `cohan-restaurant-backend/src/services/payroll/payrollCalculator.service.js`
   - normalize salary type;
   - calculate monthly/hourly/shift/commission regular income;
   - include staff allowance once;
   - preserve existing overtime, insurance and tax policy inputs.
2. `cohan-restaurant-backend/src/services/payroll/payrollRuntime.service.js`
   - use active staff membership scope;
   - use UTC-stable payroll day helpers;
   - count overlapping shifts and payable timesheets;
   - remove stale draft payroll items;
   - summarize partial payments accurately.
3. `cohan-restaurant-backend/src/services/payroll/payrollValidation.service.js`
   - validate the same membership roster and salary-type-specific rate;
   - detect stale/missing period items.
4. `cohan-restaurant-backend/graphql/resolvers/staff/query.js`
   - reject period and restaurant mismatch in payroll overview.
5. `src/hooks/usePayroll.js`
   - skip manager payroll data queries until restaurant scope exists.
6. `src/components/Dashboard_Manager/PayrollPage/PayrollManagement.jsx`
   - clear stale period on restaurant change;
   - fix refresh argument handling;
   - derive official mode from period state;
   - export the full official period;
   - align lifecycle action availability with period status.

## Test files

1. `cohan-restaurant-backend/tests/services/payroll-calculation-integrity.test.js`
2. `cohan-restaurant-backend/tests/resolvers/payroll-overview-scope.test.js`
3. `src/hooks/usePayroll.test.js`
4. `src/components/Dashboard_Manager/PayrollPage/PayrollManagement.test.jsx`

## Verification commands

```bash
npm --prefix cohan-restaurant-backend test -- tests/services/payroll-calculation-integrity.test.js tests/resolvers/payroll-overview-scope.test.js tests/resolvers/payroll-payment.resolver.test.js
npx vitest run src/hooks/usePayroll.test.js src/components/Dashboard_Manager/PayrollPage/PayrollManagement.test.jsx
npm run check:graphql
npm run build
```

## Review checklist

- No schema migration.
- No policy-rate changes.
- No readiness or permission bypass.
- No finalized/paid/locked snapshot mutation.
- No new dependency or duplicate fetching layer.
