# Staff role list permission fix

## Current behavior

The add-employee modal receives the selected restaurant correctly, but clicking **Tiếp theo** remains on step 1 and shows that the selected role is unavailable. `EmployeeFormModal` intentionally blocks when `roleList` is loading, empty, errored, or cannot resolve the selected role slug.

## Root cause

Flow traced:

1. `Role` documents provide authoritative role ids and slugs.
2. `UserQuery.roleList` loads those documents but authorizes only fixed role names (`admin`, `manager`, `hr`).
3. `useStaffManagement` queries `roleList` and maps slug to id.
4. `EmployeeFormModal` validates `selectedRoleRecord` before advancing.
5. Current RBAC and restaurant-management flows grant effective permissions independently of a fixed global role slug, so an account allowed to manage staff can still be rejected by `roleList`.

The prior `userType` normalization widened the legacy helper but did not fix this mismatched authorization boundary.

## Scope

- Authorize `roleList` with the existing effective `staff.read` permission.
- Preserve the existing role query result and frontend mapping contract.
- Add one resolver regression test for a nonstandard role carrying `staff.read`.

## Files changing

- `cohan-restaurant-backend/graphql/resolvers/user/query.js`: replace the fixed-role guard on `roleList` with the existing permission service.
- `cohan-restaurant-backend/tests/resolvers/user-auth-me.test.js`: cover permission-based role-list access.

## Acceptance criteria

- A signed-in user with effective `staff.read` can load `roleList` even when its role slug is not `admin`, `manager`, or `hr`.
- Users without `staff.read` remain forbidden.
- The role list response shape is unchanged.
- The employee modal can resolve `server` and advance when that role exists in the database.

## Validation

- Run targeted Vitest for `tests/resolvers/user-auth-me.test.js` when a runnable checkout is available.
- Review GraphQL schema compatibility; no schema change is expected.
- Review the final diff for permission or contract drift.

## Out of scope

- Seeding missing role documents.
- Redesigning the employee modal.
- Changing staff creation or BrandMembership synchronization.
