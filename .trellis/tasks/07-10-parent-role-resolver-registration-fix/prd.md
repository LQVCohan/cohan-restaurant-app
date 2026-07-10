# ParentRole resolver registration fix

## Current behavior

The add-employee modal has a selected restaurant and staff role, but clicking **Tiếp theo** remains on step 1 and reports that the role list is unavailable. No request is sent by that button because it only runs local step validation.

## Root cause

Flow traced:

1. `Role` documents reference `ParentRole` documents in MongoDB.
2. `UserQuery.roleList` populates `parentRole` and returns lean objects containing `_id`.
3. `StaffRoleListForManagement` requests the non-null field `parentRole.id`.
4. `role/types.js` already maps `ParentRole._id` to GraphQL `ParentRole.id`.
5. `role/index.js` exports that type resolver.
6. The root `graphql/resolvers/index.js` registers `Role` but omits `ParentRole`, so the executable schema never receives the mapping.
7. The earlier `roleList` query fails during serialization; Apollo stores `roleListError`; the modal reads that error on **Tiếp theo** and blocks before any staff mutation.

## Scope

- Register the existing `ParentRole` resolver in the root resolver map.
- Add one focused integration-level resolver wiring test.
- Preserve schema, authorization, restaurant scope, modal behavior, and staff creation payloads.

## Files changing

- `cohan-restaurant-backend/graphql/resolvers/index.js`: expose `role.ParentRole`.
- `cohan-restaurant-backend/tests/resolvers/role-resolver-index.test.js`: assert lean `_id` resolution through the actual root resolver map.

## Acceptance criteria

- `resolvers.ParentRole.id({ _id })` returns that id.
- `roleList` can serialize `parentRole { id slug }` for lean populated documents.
- Clicking **Tiếp theo** can advance when required step-one fields and an existing role are selected.
- No new dependency, schema change, or UI workaround is introduced.

## Validation

- Run the focused resolver-index test when a runnable checkout is available.
- Run `npm run check:graphql` when a runnable checkout is available.
- Re-fetch the changed files from `main` and review the final diff.

## Out of scope

- Seeding missing roles.
- Redesigning the employee modal.
- Changing RBAC permissions or the create-staff mutation.
