# Staff performance demo data

## Current behavior

The repository has separate demo seeds for scheduling, customers, menu, promotions, and payroll. The scheduling seed also creates a small performance scenario, but its incident/snapshot ordering and account coverage are not sufficient for a deterministic July 2026 performance demo.

The existing local database also contains two stale discriminator values: `hr.demo@cohan.local` and `accountant.demo@cohan.local` have the correct role documents but are stored with `userType: CUSTOMER`. The schema and route policy require `HR` and `ACCOUNTANT` respectively.

## Goal

Create one local-only, idempotent seed for 01/07/2026–31/07/2026 that first repairs the two demo operator account types, then reuses the existing restaurant, manager, menu items, customers, and seven demo staff accounts.

## Fixed scope

- Brand: `6a447f6bea9844b4c8544c49`
- Restaurant: `69ce9e2e8d8d711f12e251b1`
- Manager: `69f7162dab80d0aaef80d5c8`
- HR account: `hr.demo@cohan.local` must be `userType: HR`, role `hr`
- Accountant account: `accountant.demo@cohan.local` must be `userType: ACCOUNTANT`, role `accountant`
- Current period: `2026-07-01T00:00:00.000Z` to `2026-07-31T23:59:59.999Z`
- Previous period: June 2026, only to support trend display
- Environment: local/development
- Menu source: existing available menu items only
- Reset: delete only records tagged by this seed and exact-period snapshots/reviews for the selected demo staff

## Account scenarios

1. `staff.server.demo@cohan.local`: excellent server
2. `staff.supervisor.demo@cohan.local`: good supervisor
3. `staff.cashier.demo@cohan.local`: average cashier with attributable operational issues
4. `staff.chef.demo@cohan.local`: needs-attention head chef with kitchen delay/return evidence
5. `staff.kitchenhelper.demo@cohan.local`: average assistant-chef evidence scenario
6. `staff.exception.demo@cohan.local`: poor performance with attendance/compliance issues
7. `staff.parttime.demo@cohan.local`: incident deduction followed by accepted appeal and score reversal

## Flow traced

`User discriminator/Role -> frontend role resolution and manager route policy -> Staff/Restaurant/Review/Order/KitchenOrderWorkItem/Shift/Timesheet schemas -> staffPerformance service calculation -> performance incident/appeal records -> GraphQL staff performance queries -> manager performance page and employee timeline`.

## Implementation constraints

- Repair only the two exact demo operator emails before performance data is seeded.
- Use the native Mongo collection only for the discriminator-key repair because normal Mongoose updates may strip an existing `CUSTOMER` to `HR`/`ACCOUNTANT` transition.
- Reuse current models and calculation services.
- Do not create replacement accounts when the expected demo accounts are missing; fail with a clear list instead.
- Do not create menu items; fail when no usable existing item exists.
- Never store credentials or reset passwords.
- Use a unique demo tag on mutable records.
- Keep staff profile changes limited to demo-only role labels needed by the quality-role resolver.
- Seed incident adjustments/reversals deterministically so the script works with a normal standalone local MongoDB as well as a replica set.

## Acceptance criteria

- The repair command changes HR from `CUSTOMER` to `HR` and accountant from `CUSTOMER` to `ACCOUNTANT` while preserving their expected role documents.
- The performance seed runs the repair command first.
- Running the repair or seed twice produces the same logical state without duplicates.
- Seven current-period snapshots exist and contain all five score components.
- The seven staff rows cover excellent, good, average, needs-attention, poor, kitchen evidence, cashier evidence, incident adjustment, and accepted appeal reversal.
- The manager has restaurant access through the current brand membership contract.
- The verifier exits non-zero when operator account types, required accounts, snapshots, evidence, or appeal/reversal records are missing.
- No non-demo customer, staff, order, review, shift, or performance record is deleted.

## Validation

```bash
npm run repair:demo:operator-account-types --prefix cohan-restaurant-backend
npm run seed:demo:staff-performance --prefix cohan-restaurant-backend
npm run verify:demo:staff-performance-data --prefix cohan-restaurant-backend
npm run test:performance --prefix cohan-restaurant-backend
npm run build --prefix cohan-restaurant-backend
```

## Out of scope

- Resetting demo account passwords
- Creating menu/catalog data
- Production/staging deployment
