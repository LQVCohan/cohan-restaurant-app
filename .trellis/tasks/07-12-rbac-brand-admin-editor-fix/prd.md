# Fix RBAC Brand Admin editor and permission layout

## Current behavior and root cause

- The RBAC screen reads write access only from the account-level `user` role. Active `BrandMembership` roles are available separately in `AuthContext`, so a Brand `owner/admin` account with legacy or mismatched account-role data can open the Brand scope but the role editor remains read-only.
- Backend `requirePermission("role.write")` also derives permissions only from the account role. It does not recognize an active Brand `owner/admin` membership.
- The existing role mutation guard already treats every non-system-admin as a constrained operator: system/protected roles stay immutable, custom roles must inherit from `staff`, and assigned permission codes stay inside the manager whitelist.
- `RbacCompactLayout.css` forces the role permission checklist into CSS columns with a viewport-bound inner scrollbar. At desktop manager widths this creates nested scrolling, non-linear reading order, and clipped content like the reported screenshot.

## End-to-end flow traced

1. `Role`/`ParentRole` Mongoose schemas define the shared role catalog.
2. `RoleMutation.createRole/updateRole` calls `requirePermission("role.write")`, then applies protected-role, parent-role, and permission-whitelist guards.
3. `PermissionQuery.permissions`, `RoleQuery.role`, and `RoleQuery.parentRoles` use the shared authorization service.
4. `useRbacManagement` loads roles/permissions and sends `createRole`/`updateRole` mutations.
5. `AuthProvider` exposes `user` and active `brandMemberships` separately.
6. `RbacManagement` currently checks only `user` when enabling the editor.
7. Global `RbacCompactLayout.css` overrides the component SCSS and creates the broken nested-scroll layout.

## Files changing and why

- `cohan-restaurant-backend/src/services/auth/authorization.service.js`: allow active Brand `owner/admin` memberships to use the narrow RBAC/staff permission set needed by this screen, without treating them as system admins.
- `cohan-restaurant-backend/tests/services/authorization.service.test.js`: cover active/inactive Brand Admin membership behavior and preserve protected permission boundaries.
- `src/components/Dashboard_Manager/RBAC/RbacManagement.jsx`: include active Brand `owner/admin` membership in view/write/assignment affordances.
- `src/components/Dashboard_Manager/RBAC/RbacManagement.test.jsx`: verify Brand Admin can edit custom roles while protected roles remain locked.
- `src/styles/RbacCompactLayout.css`: replace the column-based, viewport-limited role checklist with a responsive grid and natural page flow.

## Acceptance criteria

1. An active Brand `owner/admin` can load RBAC data and edit custom staff-derived roles.
2. Inactive or invited Brand memberships do not grant RBAC write access.
3. Brand Admin is not promoted to system admin: protected/system roles remain immutable and sensitive permission definitions remain unavailable.
4. The role permission groups read left-to-right in a responsive grid and do not use a nested viewport-height scrollbar.
5. Existing system Admin and Manager behavior remains unchanged.
6. No GraphQL schema, database model, dependency, or unrelated page changes.

## Validation plan

- `npx vitest run cohan-restaurant-backend/tests/services/authorization.service.test.js`
- `npx vitest run src/components/Dashboard_Manager/RBAC/RbacManagement.test.jsx`
- `npm run check:graphql`
- `npm run build` when a runnable checkout is available.
