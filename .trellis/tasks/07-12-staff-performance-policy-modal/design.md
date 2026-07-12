# Design

## Storage

Reuse the existing one-document-per-restaurant `SystemSetting` model:

```text
performancePolicy.levelThresholds = {
  excellentMin: 90,
  goodMin: 80,
  averageMin: 65,
  needsAttentionMin: 50
}
```

`poor` is implicit below `needsAttentionMin`. No new collection or migration is required because Mongoose defaults fill missing policy data.

## Public contract

Add a dedicated staff-performance contract instead of exposing the broad system-settings mutation:

- `staffPerformancePolicy(restaurantId: ID!): StaffPerformancePolicy!`
- `updateStaffPerformancePolicy(input: UpdateStaffPerformancePolicyInput!): StaffPerformancePolicy!`

The response includes:

- editable thresholds;
- read-only weights;
- `editableFields` and `lockedFields` for UI clarity;
- update metadata.

The mutation input contains only the four threshold fields, so protected formula constants cannot be changed through GraphQL.

## Authorization

Resolver boundary:

1. require authenticated user;
2. require access to the requested restaurant;
3. service restricts role to `admin`, `manager`, or `hr`;
4. update validates the complete threshold ordering;
5. audit log records before/after policy values.

## Calculation

`recalculateStaffPerformanceSnapshots` resolves the policy once per restaurant and passes the same threshold object to every employee calculation. Existing weighted component formulas remain unchanged. Only `performanceLevel` classification uses the policy.

## UI

Replace the static `<details>` panel with a compact “Cấu hình đánh giá” action. The modal has:

- summary of the protected 25/25/20/20/10 formula;
- locked rules section;
- editable threshold fields with range preview;
- inline validation and saving status;
- note that changes apply after recalculation and do not rewrite prior snapshots.

Use the page’s existing modal classes and SCSS tokens; no new library.
