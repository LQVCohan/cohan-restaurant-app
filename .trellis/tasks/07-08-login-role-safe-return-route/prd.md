# Role-safe login return route

## Current behavior and root cause

When an authenticated user logs out from a protected route such as `/manager`, `AuthProvider.logout` currently clears token/user state before navigating to `/login`. During that transition, the still-mounted `PrivateRoute` can observe an anonymous session on `/manager` and redirect to `/login` with `location.state.from` set to the old manager route. `Login.jsx` then legitimately restores that recorded route after the next successful login, even when the next account is a customer.

The backend login flow is already correct: `loginWithPendingVerification` rebuilds the payload with the current account's populated role and returns the current `roleName`. The defect is the explicit logout ordering, not the login schema, resolver, role mapping, or route policy.

## End-to-end flow

`User role -> loginWithPendingVerification -> login GraphQL mutation -> AuthProvider.login/logout -> PrivateRoute records from -> Login return redirect -> portal UI`.

## Scope

- Keep the existing login return-to behavior for genuine unauthenticated protected-route visits.
- During explicit logout, navigate away from the protected portal before publishing the anonymous auth state.
- Keep token, user, business context, cart, Apollo cache, and manager workspace cleanup unchanged.
- Add focused coverage that locks navigation before account cache clearing.

## Files to change

- `src/context/AuthProvider.jsx`: move the `/login` navigation to the start of the explicit logout transition.
- `src/context/__tests__/AuthProvider.logout-route-order.test.jsx`: verify logout navigates before clearing the Apollo account cache.

## Constraints

- Do not change GraphQL schema/resolvers, `Login.jsx`, route access rules, or portal layouts.
- Do not remove legitimate `location.state.from` restoration for users who open a protected link while signed out.
- Do not add storage keys, flags, dependencies, or a second routing policy.
- Preserve immediate local session cleanup and the existing Apollo cache race fix.

## Acceptance criteria

1. Explicit logout leaves `/manager` before the anonymous state can make `PrivateRoute` record it as a login return target.
2. Logging in as a customer after logging out from admin lands on the customer default route instead of the restaurant dashboard.
3. Direct unauthenticated access to a protected route still records `from` through `PrivateRoute`.
4. Logout still clears authentication, business context, cart, manager workspace state, and Apollo account cache.
5. Existing auth provider tests remain green.

## Validation plan

- `npx vitest run src/context/__tests__/AuthProvider.test.jsx src/context/__tests__/AuthProvider.login-race.test.jsx src/context/__tests__/AuthProvider.logout-route-order.test.jsx`
- `npm run check:conflicts`
- `npm run build`

## Out of scope

- Changing backend authorization or role definitions.
- Rewriting login return-route policy.
- Altering manager workspace page selection beyond existing cleanup and permission guards.
