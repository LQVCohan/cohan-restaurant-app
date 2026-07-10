# Staff role list permission fix

## Current behavior

The add-employee modal receives the selected restaurant correctly, but clicking **Tiếp theo** remains on step 1 and shows that the selected role is unavailable. `EmployeeFormModal` intentionally blocks when `roleList` is loading, empty, errored, or cannot resolve the selected role slug.

## Root cause

Flow traced:

1. `Role` documents provide authoritative role ids and slugs.
2. Authentication populates both the direct role and its `parentRole` inheritance.
3. `UserQuery.roleList` authorizes through the shared legacy `requireRole` helper.
4. `useStaffManagement` queries `roleList` and maps slug to id.
5. `EmployeeFormModal` validates `selectedRoleRecord` before advancing.

The shared `hasRole` helper recognized `userType`, `roleName`, and the direct role, but ignored `role.parentRole`. An account using a custom restaurant-management role could therefore inherit `manager` access everywhere else while `roleList` still rejected it. The modal then stopped locally before any create-staff mutation was sent.

## Scope

- Include inherited parent-role slug and name in the shared role resolution helper.
- Preserve existing direct-role and specialized staff-role behavior.
- Add one focused regression test for an inherited management role.

## Files changed

- `cohan-restaurant-backend/utils/authz.js`: include `role.parentRole` in normalized role candidates.
- `cohan-restaurant-backend/tests/utils/authz.test.js`: cover a custom role inheriting from `manager`.

## Acceptance criteria

- A user whose direct role inherits from `manager` passes checks accepting `admin`, `manager`, or `hr`.
- Existing `userType: ADMIN` matching remains valid.
- Specialized staff roles such as `server` still match both their direct slug and the `staff` group.
- The `roleList` GraphQL response and frontend contracts remain unchanged.

## Validation

- Review the role-list flow from resolver to Apollo hook and modal validation.
- Run `vitest run tests/utils/authz.test.js` when a runnable checkout is available.
- No GraphQL schema or frontend build change is required.

## Out of scope

- Seeding missing role documents.
- Redesigning the employee modal.
- Changing staff creation or BrandMembership synchronization.
