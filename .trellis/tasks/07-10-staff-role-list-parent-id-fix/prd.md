# Staff role list parent id serialization fix

## Current behavior

The add-employee modal receives the selected restaurant and selected staff-role slug, but clicking **Tiếp theo** stays on step 1. The role dropdown is rendered from frontend metadata while validation depends on the GraphQL `roleList` response.

## Root cause

Flow traced:

1. `Role` documents reference `ParentRole` documents in MongoDB.
2. `UserQuery.roleList` populates `parentRole` and returns lean objects.
3. `StaffRoleListForManagement` requests `parentRole { id slug }`.
4. The GraphQL schema declares `ParentRole.id` as non-null.
5. Lean populated parent-role objects expose `_id`, but the resolver map defines `Role.id` only and has no `ParentRole.id` resolver.
6. GraphQL therefore rejects the response during serialization, Apollo exposes `roleListError`, and `EmployeeFormModal` blocks step 1 before any create mutation runs.

## Scope

- Add the missing `ParentRole.id` resolver using the same `_id` fallback pattern as `Role.id`.
- Add one focused regression test for a lean parent-role object containing only `_id`.
- Preserve role querying, restaurant scope, permissions, mutation behavior, and response fields.

## Files changing

- `cohan-restaurant-backend/graphql/resolvers/role/types.js`: map `ParentRole._id` to GraphQL `ParentRole.id`.
- `cohan-restaurant-backend/tests/resolvers/role-mutation-rbac-response.test.js`: cover the serialization contract.

## Acceptance criteria

- `parentRole.id` resolves for both objects containing `id` and lean objects containing only `_id`.
- `roleList` can serialize the `parentRole { id slug }` selection without a non-null field error.
- No permission, schema, staff-creation, or BrandMembership behavior changes.

## Validation

- Run the focused role resolver test when a runnable checkout is available.
- Review the final diff for unrelated RBAC or role-response changes.

## Out of scope

- Automatically seeding missing RBAC data.
- Redesigning the employee modal.
- Changing staff-role assignment rules.
