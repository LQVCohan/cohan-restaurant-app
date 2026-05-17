# Demo: Schedule → Attendance → Payroll Readiness

This guide documents the demo workflow for validating the end-to-end scheduling, attendance, and payroll readiness module.

## What this demo covers

The module now supports the following flow:

1. Build and publish schedules.
2. Record attendance and attendance exceptions.
3. Review pending attendance corrections, off-schedule attendance, and overtime.
4. Run Payroll Readiness checks.
5. Navigate from readiness issues to the correct resolution screen.
6. Block payroll finalization on the backend when readiness has blocking issues.
7. Finalize payroll only after readiness is clean.

## Demo seed script

The PR adds:

```bash
cohan-restaurant-backend/scripts/seedPayrollReadinessDemo.js
```

Run it from the backend folder:

```bash
cd cohan-restaurant-backend
node scripts/seedPayrollReadinessDemo.js
```

Optional reset:

```bash
cd cohan-restaurant-backend
node scripts/seedPayrollReadinessDemo.js --reset
```

The script uses:

```bash
MONGO_URI=mongodb://localhost:27017
MONGO_DB=foodhub
DEMO_PASSWORD=Demo@123456
```

Override these with environment variables if your local database uses different values.

## Demo accounts

The script creates or reuses these accounts:

```text
payroll.ready.manager.demo@cohan.local
payroll.ready.accountant.demo@cohan.local
payroll.ready.clean.staff.demo@cohan.local
payroll.ready.issue.staff.demo@cohan.local
```

Default password:

```text
Demo@123456
```

## Demo restaurant

The script creates or reuses:

```text
Cohan Payroll Readiness Demo
```

All seeded demo records are tagged with:

```text
[demo-payroll-readiness]
```

## Seeded payroll periods

The script creates two payroll periods for the demo restaurant.

### 1. READY period

Name:

```text
Payroll Readiness Demo - READY
```

Dates:

```text
2026-06-01 → 2026-06-07
```

Expected behavior:

```text
payrollReadiness.readyToFinalize = true
blockingCount = 0
```

This period has:

- published schedule;
- schedule acknowledgements;
- valid shifts;
- matching completed timesheets;
- payroll settings;
- payroll items;
- no pending correction/off-schedule/overtime blockers.

This period should be safe to finalize.

### 2. BLOCKED period

Name:

```text
Payroll Readiness Demo - BLOCKED
```

Dates:

```text
2026-06-08 → 2026-06-14
```

Expected behavior:

```text
payrollReadiness.readyToFinalize = false
blockingCount > 0
```

This period intentionally includes blockers:

- schedule is not published;
- off-schedule attendance is pending approval;
- attendance correction is pending;
- overtime request is not completed;
- payroll items are not seeded for the period.

The backend `finalizePayrollPeriod` resolver should reject this period with:

```text
PAYROLL_PERIOD_NOT_READY
```

## Manual demo flow

### Step 1 — Run seeds

```bash
cd cohan-restaurant-backend
node scripts/seedPayrollReadinessDemo.js --reset
```

### Step 2 — Log in

Use either:

```text
payroll.ready.manager.demo@cohan.local
```

or:

```text
payroll.ready.accountant.demo@cohan.local
```

with password:

```text
Demo@123456
```

### Step 3 — Open Payroll

Open the manager dashboard and go to:

```text
Payroll
```

Choose the restaurant:

```text
Cohan Payroll Readiness Demo
```

### Step 4 — Test blocked period

Select:

```text
Payroll Readiness Demo - BLOCKED
```

Click:

```text
Kiểm tra trước khi chốt
```

Expected:

- readiness panel displays `Chưa sẵn sàng chốt lương`;
- blocking issues appear across schedule, attendance, approvals, or payroll;
- `Chốt kỳ` is disabled or guarded;
- issue action buttons navigate to the correct UI area.

Useful issue action checks:

```text
SCHEDULE_NOT_PUBLISHED → Schedule page
OFF_SCHEDULE_ATTENDANCE_PENDING → Staff > Attendance > Ngoài lịch
ATTENDANCE_CORRECTION_PENDING → Staff > Attendance > Corrections
OVERTIME_PENDING → Staff > Attendance > Overtime
PAYROLL_PERIOD_EMPTY → Payroll
```

### Step 5 — Test backend finalize guard

Try to finalize the blocked period through UI or GraphQL.

Expected backend result:

```text
PAYROLL_PERIOD_NOT_READY
```

Expected behavior:

- period remains `draft`;
- no payroll items are finalized;
- readiness failure is logged through payroll event logging.

### Step 6 — Test ready period

Select:

```text
Payroll Readiness Demo - READY
```

Click:

```text
Kiểm tra trước khi chốt
```

Expected:

```text
Sẵn sàng chốt lương
blockingCount = 0
```

Now click:

```text
Chốt kỳ
```

Expected:

- backend readiness guard passes;
- existing finalize logic runs;
- period status becomes `finalized`;
- payroll items become `finalized`.

## GraphQL checks

Query readiness:

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

Finalize mutation:

```graphql
mutation FinalizePayrollPeriod($periodId: ID!) {
  finalizePayrollPeriod(periodId: $periodId) {
    id
    status
    finalizedAt
  }
}
```

Expected blocked-period error:

```text
PAYROLL_PERIOD_NOT_READY
```

## Local verification commands

Backend syntax check:

```bash
cd cohan-restaurant-backend
node --check scripts/seedPayrollReadinessDemo.js
```

Focused backend tests:

```bash
cd cohan-restaurant-backend
npx vitest run \
  tests/resolvers/payroll-finalize-readiness-guard.test.js \
  tests/resolvers/payroll-readiness.resolver.test.js \
  tests/services/payroll-readiness.service.test.js \
  tests/services/payroll-correctness.test.js
```

Frontend readiness tests:

```bash
npm test -- src/components/Dashboard_Manager/PayrollPage/components/PayrollReadinessPanel.test.jsx
npm test -- src/components/Dashboard_Manager/PayrollPage/PayrollManagement.readiness.test.jsx
npm test -- src/utils/payrollReadinessRouting.test.js
npm run build -- --mode development
```

## Notes

The seed script is intended for local/dev/demo environments only. Do not run it against production data.

If you already have other active staff in the demo restaurant, payroll validation may report additional staff/timesheet warnings or errors. For the cleanest demo, run the script with `--reset` against a local development database.
