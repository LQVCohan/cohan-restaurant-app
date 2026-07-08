# Role-safe login return route

## Current behavior and root cause

When an authenticated user logs out while a protected route such as `/manager` is still mounted, `PrivateRoute` may redirect to `/login` with `location.state.from` pointing to that route. `Login.jsx` currently trusts this return path after any successful login. A different account can therefore inherit the previous account's route before the route guard corrects it, which can expose the wrong portal UI and leave the browser on the old dashboard until refresh.

The backend login flow is already correct: the resolver rebuilds the authenticated user payload with the current account's populated role and returns `roleName`. The defect is at the frontend return-route decision.

## End-to-end flow

`User role -> loginWithPendingVerification -> login GraphQL mutation -> AuthProvider.login -> Login redirect effect -> PrivateRoute/canAccessRoute -> portal UI`.

## Scope

- Reuse `canAccessRoute` and `getRoleHomeRoute`.
- Restore `location.state.from` only when the newly authenticated role can access its pathname.
- Otherwise redirect to the new role's default landing page.
- Add focused regression coverage for an admin `/manager` return path followed by customer authentication.

## Files to change

- `src/components/Login.jsx`: validate the remembered return route against the new user's role before navigating.
- `src/components/Login.test.jsx`: assert that a customer does not inherit `/manager` and lands on `/`.

## Constraints

- Do not change the GraphQL schema, resolver, AuthProvider session contract, route access rules, or portal layouts.
- Preserve the intended return-to behavior when the new role is allowed to access the requested route.
- Do not add storage keys, flags, dependencies, or a second routing policy.

## Acceptance criteria

1. A customer logging in with `from: /manager` is redirected to `/`.
2. Manager/admin/staff default routes continue to come from `getRoleHomeRoute`.
3. An allowed return route is still restored.
4. Direct unauthenticated access to a protected route still records `from` through `PrivateRoute`.
5. Existing login tests remain green.

## Validation plan

- `npx vitest run src/components/Login.test.jsx`
- `npm run check:conflicts`
- `npm run build`

## Out of scope

- Changing backend authorization or role definitions.
- Reworking logout timing or Apollo cache handling.
- Altering manager workspace page selection beyond existing route and permission guards.
