# Staff profile GraphQL enum contract

## Current behavior

Opening `/manager#staff` runs `StaffList`. MongoDB staff documents store profile enums in lowercase, including `salaryType: "monthly"`. `sanitizeStaffPrivateProfile()` preserves that valid persistence value, but the GraphQL schema exposes `StaffSalaryType` as `MONTHLY | HOURLY | SHIFT | COMMISSION`. Because the shared resolver map does not define the enum's internal values, GraphQL rejects `monthly` while serializing the response and Apollo treats the whole staff list as failed.

The same contract drift exists for the other lowercase staff-profile enums declared beside salary type: gender, marital status, contract type, and training status.

## End-to-end flow

1. `models/staff.model.js` stores lowercase staff enum values.
2. `graphql/resolvers/staff/query.js#staffList` loads scoped staff and calls `sanitizeStaffPrivateProfile()`.
3. `src/security/userDtos.js` returns `salaryType` and the other profile fields without changing valid persistence values.
4. `graphql/schema/user.graphql` exposes uppercase GraphQL enum names.
5. `graphql/resolvers/base.js` is the shared enum internal-value boundary but lacks mappings for these staff-profile enums.
6. `src/hooks/useStaffManagement.js` requests `salaryType` in `StaffFields`.
7. `StaffManagement.jsx` passes the Apollo error to the employee dashboard, producing the visible failure state.

## Scope

- Add the missing lowercase internal-value mappings in the existing shared GraphQL resolver map.
- Add a focused regression test using the executable schema and a real `StaffPrivateProfile` query result.
- Keep persistence, DTOs, staff query authorization, Apollo operations, and UI unchanged.

## Files to change

- `cohan-restaurant-backend/graphql/resolvers/base.js`: define the existing schema enums' lowercase internal values.
- `cohan-restaurant-backend/tests/schema/staff-management-schema.test.js`: prove lowercase staff values serialize to uppercase GraphQL enum names.

## Acceptance criteria

- A staff row containing `salaryType: "monthly"` serializes as `MONTHLY` without a GraphQL error.
- Gender, marital status, contract type, and training status use the same established shared mapping pattern.
- Existing staff management schema contract tests remain valid.
- No frontend workaround, data migration, new abstraction, or dependency is introduced.

## Validation plan

- Run the focused Vitest file: `cohan-restaurant-backend/tests/schema/staff-management-schema.test.js`.
- Run the repository GraphQL contract check when a runnable checkout is available.

## Out of scope

- Changing stored enum casing.
- Redesigning the staff page or its error state.
- Modifying restaurant scope, permissions, audit behavior, polling, or Apollo caching.
