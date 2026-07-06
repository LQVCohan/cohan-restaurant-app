# Manager sidebar portal shortcuts

## Current behavior

The manager sidebar footer only displays the signed-in user's avatar, name, role, and active Brand scope. Users must leave the manager workspace through another screen or manually change the URL.

## Root cause

`Sidebar.jsx` has no portal navigation actions in its footer even though the target routes already exist. This is a missing UI action, not a GraphQL or backend contract issue.

## End-to-end flow

1. `AppRouter.jsx` maps `/` to the customer Home page.
2. `/staff` redirects to `/staff/dashboard` behind `STAFF_SHARED_ROLES` and `canAccessRoute`.
3. `ManagerLayout.jsx` renders `Sidebar.jsx` and passes only manager-page callbacks.
4. `Sidebar.jsx` renders the identity block in `.sidebar-footer`.
5. `Sidebar.test.jsx` is the nearest component test boundary.

No Mongoose schema, resolver, service, GraphQL operation, Apollo hook, audit log, or realtime side effect participates in this navigation-only change.

## Scope

- Add a Home link to `/` in the manager sidebar footer.
- Add a Staff workspace link to `/staff/dashboard` only when the current role can access that route.
- Keep the existing user identity block unchanged.
- Reuse the current manager sidebar visual system and installed icon package.

## Files to change

- `src/components/Dashboard_Manager/Sidebar.jsx`: render the two portal links and reuse `canAccessRoute` for the Staff link.
- `src/components/Dashboard_Manager/Styles/SidebarPortalActions.scss`: style the compact footer actions and preserve expanded, collapsed, and mobile behavior.
- `src/components/Dashboard_Manager/Sidebar.test.jsx`: verify destinations and role-aware visibility.

## Acceptance criteria

- A manager sees `Trang chủ` and `Khu nhân viên` actions below their user information.
- `Trang chủ` points to `/`.
- `Khu nhân viên` points to `/staff/dashboard`.
- A role blocked from `/staff/dashboard` does not see the Staff action.
- Existing manager navigation callbacks and active-item behavior remain unchanged.
- Both actions have visible keyboard focus and descriptive accessible names.

## Out of scope

- Changing route access policy.
- Adding backend permissions or GraphQL fields.
- Reworking the full sidebar navigation or user profile card.
- Adding dependencies.

## Validation plan

- Run the targeted `Sidebar.test.jsx` Vitest test when a runnable checkout is available.
- Run the frontend build when a runnable checkout is available.
- Review the diff for route-policy duplication and collapsed-sidebar regressions.
