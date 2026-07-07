# Clear previous account cache on logout

## Current behavior and root cause

The backend login resolver returns the newly authenticated user and `Login.jsx` passes that result to `AuthProvider`. Logout clears the token and React state but leaves Apollo Client cache intact. Cache-first screens can therefore render data from the earlier account until the page reload creates a new cache.

## Flow traced

`User schema/AuthPayload -> UserMutation.login -> Login mutation -> AuthProvider -> Apollo cache -> account UI`.

## Files changed

- `src/context/AuthProvider.jsx`: clear the existing Apollo store during logout.
- `src/context/__tests__/AuthProvider.test.jsx`: cover Apollo cache cleanup on logout.

## Acceptance criteria

- Logout clears token, user state, restaurant state, cart state, and Apollo cache.
- Signing in with another account shows the new account data without reloading.
- Login schema, resolver, permissions, refresh tokens, and routing remain unchanged.

## Validation

- `npx vitest run src/context/__tests__/AuthProvider.test.jsx`
- `npm run build`

## Out of scope

- Backend authentication changes.
- Changing individual screen fetch policies.
