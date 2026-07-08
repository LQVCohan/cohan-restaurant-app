# Staff BrandMembership synchronization

## Current behavior and root cause

The normalized Brand flow keeps the active business and restaurant in manager workspace state. `restaurantForStaff` is a legacy account fallback and may be absent, so it must not be the authority used to create Brand scope. The existing add-employee flow only sent account fields and therefore had no explicit active-business context for creating `BrandMembership`.

## End-to-end flow

Manager active Brand/restaurant selection -> `AddEmployeeModal` builds `staffBusinessContext` -> existing `CreateStaff` Apollo mutation -> staff resolver validates the restaurant against the active Brand and actor scope -> existing staff account creation -> active `BrandMembership` upsert -> focused frontend and resolver tests.

## Scope

- Send the active `brandId` and `restaurantId` as request-only `staffBusinessContext` when the user clicks create.
- Remove `restaurantForStaff` from the normalized account payload in the add flow.
- Validate that the active restaurant belongs to the supplied Brand and is accessible by the actor.
- Create an active `BrandMembership` with role `staff` and the active restaurant ID.
- Keep `restaurantForStaff` only as an internal compatibility fallback for existing staff modules and older clients.
- Roll back the newly created Staff account if membership synchronization fails.

## Constraints

- `BrandMembership` remains the runtime authorization source.
- Do not infer the active Brand from fields stored on the new account when explicit business context is supplied.
- Reuse the existing `createStaff` mutation and staff account creation logic.
- Do not add a second network request, dependency, or parallel authorization source.
- Do not include legacy data migration or multi-restaurant staff editing.

## Acceptance criteria

1. The normalized add flow works when the account payload has no `restaurantForStaff`.
2. Membership uses the Brand and restaurant active in manager workspace at submit time.
3. A mismatched Brand/restaurant pair is rejected before creating the account.
4. The membership role is `staff`, status is `active`, and `restaurantIds` contains the active restaurant.
5. Membership failure removes the newly created Staff account.
6. Older callers that only send `restaurantForStaff` continue through the compatibility fallback.

## Validation plan

- Run the focused frontend test for `AddEmployeeModal` business-context submission.
- Run the focused resolver test for context validation and membership creation.
- Run the existing staff create/access resolver tests.
- Run the GraphQL schema validation check.

## Out of scope

- Backfilling memberships for existing Staff records.
- Removing `restaurantForStaff` from every legacy staff, payroll, and scheduling reader.
- Moving an existing employee between Brands or synchronizing staff edits.
- Redesigning the full Staff Management interface.
