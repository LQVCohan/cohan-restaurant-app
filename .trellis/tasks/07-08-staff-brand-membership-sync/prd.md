# Staff BrandMembership synchronization

## Current behavior and root cause

The employee modal already submits `restaurantForStaff` through the existing `createStaff` mutation. The resolver creates a `Staff` document and stores `restaurantForStaff`, but it does not create the active `BrandMembership` required by runtime restaurant-scope guards. Staff management therefore shows the employee while Brand scope remains incomplete.

## End-to-end flow

`Staff` / `BrandMembership` / `Restaurant` Mongoose models -> `createStaff` resolver -> `CreateStaff` Apollo mutation in `useStaffManagement` -> `EmployeeFormModal` submit action -> focused model test.

## Scope

- When a new Staff document is created with `restaurantForStaff`, resolve the restaurant `brandId`.
- Upsert one active `BrandMembership` with role `staff` and the selected restaurant ID.
- Stop creation when the selected restaurant does not exist or has no Brand.
- If membership synchronization fails after the Staff save, roll back the new Staff document.
- Keep the existing GraphQL and frontend payload unchanged.

## Constraints

- Reuse the existing `BrandMembership` model and its `staff` role/scope convention.
- Do not add a second mutation, frontend request, dependency, or authorization source.
- Do not include legacy data migration or multi-restaurant staff editing.
- Run synchronization only for newly created Staff documents.

## Acceptance criteria

1. Creating an employee for a restaurant in a Brand creates an active `BrandMembership` for the same user and Brand.
2. The membership role is `staff` and `restaurantIds` contains the selected `restaurantForStaff`.
3. A restaurant without a Brand does not leave a partial employee record.
4. A membership write failure rolls back the new Staff document and returns the error.
5. No GraphQL schema or frontend operation changes are required.

## Validation plan

- Run the focused Vitest model test for Staff-to-BrandMembership synchronization.
- Run the existing `staff-create-employee-code` and `staff-mutation-access` resolver tests.
- Run the GraphQL schema check only if a contract file changes; no contract change is planned.

## Out of scope

- Backfilling memberships for existing Staff records.
- Moving an existing employee between Brands or synchronizing staff edits.
- Redesigning Brand Management or Staff Management UI.
