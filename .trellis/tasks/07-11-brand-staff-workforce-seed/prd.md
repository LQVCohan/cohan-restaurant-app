# Brand staff workforce seed

## Current behavior

Staff demo data is split across profile, scheduling, two-week roster and payroll-readiness scripts. The scripts do not form one canonical dataset for Brand `6a5018c92a9577d6a9cf4bad`; most staff lack BrandMembership, part-time profiles are stored as monthly salary, and the two-week payroll demo is disconnected from the same staff and restaurant.

## Scope

Create one local/demo-only orchestrator seed that:

- targets Brand `6a5018c92a9577d6a9cf4bad` and Restaurant `6a5018c92a9577d6a9cf4bb1` by default, with environment overrides;
- reuses the existing scheduling, profile and two-week roster scripts;
- resolves or validates a manager that has active access to the target restaurant;
- creates active BrandMembership rows for manager, HR, accountant and all demo staff;
- preserves monthly salary for full-time staff and configures hourly salary for part-time staff;
- fills missing shifts and approved timesheets so all active demo staff have representative coverage across the two seeded weeks;
- creates two PayrollPeriod rows and calculates PayrollItem rows through `upsertPeriodItems`;
- adjusts part-time PayrollItem totals from actual hours and hourly rate without changing production payroll services;
- can be safely re-run without creating duplicate memberships, shifts, timesheets, periods or payroll items.

## Constraints

- Keep `assertDemoScriptAllowed` protection.
- Do not write secrets or production data.
- Do not duplicate the detailed scheduling, attendance or payroll calculation logic already present in the repository.
- Fail clearly when the Brand, Restaurant or manager scope is invalid.
- Do not modify frontend or GraphQL contracts.

## Acceptance criteria

1. One npm command seeds the complete workforce dataset.
2. The target restaurant is verified to belong to the target Brand.
3. Every active demo staff account has an active `staff` BrandMembership for the restaurant.
4. Both full-time and part-time staff are present; full-time is monthly and part-time is hourly.
5. All active demo staff have shifts in both seeded weeks and completed/approved timesheets for past dates.
6. Two payroll periods exist and contain payroll items for all active demo staff.
7. Re-running the seed is idempotent.
8. Pure helper tests cover seed step construction, salary normalization and part-time payroll calculation.

## Out of scope

- Sending real invitations or OTPs.
- Finalizing, locking or paying payroll periods.
- Changing production payroll calculation behavior.
- Seeding additional restaurants outside the selected Brand/Restaurant scope.

## Validation

```bash
npx vitest run cohan-restaurant-backend/tests/scripts/seed-brand-staff-workforce-demo.test.js
npm --prefix cohan-restaurant-backend run build
```

Runtime seed smoke requires a local/demo MongoDB and is recorded separately.
