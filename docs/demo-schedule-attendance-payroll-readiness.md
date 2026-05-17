# Demo: Schedule → Attendance → Payroll Readiness

This guide documents the demo workflow for validating the end-to-end scheduling, attendance, and payroll readiness module.

## What this demo covers

The module supports:

1. Build and publish schedules.
2. Record attendance and attendance exceptions.
3. Review pending attendance corrections, off-schedule attendance, and overtime.
4. Run Payroll Readiness checks.
5. Navigate from readiness issues to the correct resolution screen.
6. Block payroll finalization on the backend when readiness has blocking issues.
7. Finalize payroll only after readiness is clean.

## Demo seed script

Run from backend:

```bash
cd cohan-restaurant-backend
node scripts/seedPayrollReadinessDemo.js --reset
```

The script uses:

- `MONGO_URI=mongodb://localhost:27017`
- `MONGO_DB=foodhub`
- `DEMO_PASSWORD=Demo@123456`

### Demo accounts

- `payroll.ready.manager.demo@cohan.local`
- `payroll.ready.accountant.demo@cohan.local`
- `payroll.ready.clean.staff.demo@cohan.local`
- `payroll.ready.issue.staff.demo@cohan.local`

Default password:

- `Demo@123456`

### Demo restaurant

- `Cohan Payroll Readiness Demo`

### Seeded payroll periods

#### READY period

- `Payroll Readiness Demo - READY`
- `2026-06-01 → 2026-06-07`

Expected:

- `payrollReadiness.readyToFinalize = true`
- `blockingCount = 0`

#### BLOCKED period

- `Payroll Readiness Demo - BLOCKED`
- `2026-06-08 → 2026-06-14`

Expected:

- `payrollReadiness.readyToFinalize = false`
- `blockingCount > 0`

Intentional blockers:

- schedule is not published;
- off-schedule attendance is pending approval;
- attendance correction is pending;
- overtime request is not completed;
- payroll items are not seeded for the period.

Backend finalize should reject this period with:

- `PAYROLL_PERIOD_NOT_READY`

## Manual demo flow

1. Run seed:

```bash
cd cohan-restaurant-backend
node scripts/seedPayrollReadinessDemo.js --reset
```

2. Log in as manager or accountant.
3. Open Payroll.
4. Select Payroll Readiness Demo - BLOCKED.
5. Click Kiểm tra trước khi chốt.

Expected:

- readiness panel shows Chưa sẵn sàng chốt lương;
- issue actions navigate to Schedule / Staff Attendance / Payroll;
- finalize is disabled or backend-guarded.

6. Select Payroll Readiness Demo - READY.

Expected:

- readiness panel shows Sẵn sàng chốt lương;
- backend finalize guard passes;
- period can be finalized.

## GraphQL checks

```graphql
query PayrollReadiness($periodId: ID!) {
  payrollReadiness(periodId: $periodId) {
    readyToFinalize
    blockingCount
    warningCount
    issues {
      code
      severity
      message
      targetRoute
      suggestedAction
    }
  }
}
```

```graphql
mutation FinalizePayrollPeriod($periodId: ID!) {
  finalizePayrollPeriod(periodId: $periodId) {
    id
    status
    finalizedAt
  }
}
```

## Local verification

```bash
cd cohan-restaurant-backend
node --check scripts/seedPayrollReadinessDemo.js
node scripts/seedPayrollReadinessDemo.js --reset
```

If MongoDB is unavailable, report that only `node --check` was run.

## Notes

The seed script is intended for local/dev/demo environments only. Do not run it against production data.

The READY/BLOCKED expectations assume the demo is run with `--reset` on a local/dev database. Running without reset may preserve old demo blockers.
