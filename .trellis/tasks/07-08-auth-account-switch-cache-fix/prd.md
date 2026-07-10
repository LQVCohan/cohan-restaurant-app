# Prevent stale profile after account switch

## Current behavior and root cause

The login mutation and backend `me` resolver both return the correct authenticated user. The stale profile appears in the frontend when asynchronous work from the previous session finishes after a rapid logout and login:

- an in-flight refresh request can publish the previous account again;
- a late `Me` query completion can overwrite `AuthContext.user`;
- Apollo cache cleanup is already serialized with the next explicit login, but it does not invalidate those late callbacks.

## Flow traced

`User model -> UserMutation.login / UserQuery.me / refresh endpoint -> Login.jsx -> AuthProvider -> AuthContext -> customer and manager profile cards`.

The failing lifecycle is:

`account A -> refresh/Me request still pending -> logout -> login account B -> old request completes -> AuthContext is overwritten with account A`.

## Files changed

- `src/context/AuthProvider.jsx`
  - assign an epoch to each explicit login/logout session;
  - ignore refresh results whose epoch no longer matches;
  - clear the shared refresh promise when switching sessions;
  - reject `Me` results whose user ID differs from the active account;
  - keep the existing Apollo store reset before publishing the next login.
- `src/context/__tests__/AuthProvider.login-race.test.jsx`
  - retain the existing cache-reset regression;
  - cover a stale refresh response after a new login;
  - cover a late `Me` result from the logged-out account.

## Acceptance criteria

- Logout immediately clears token, user, restaurant, cart, and Apollo state.
- A refresh response from the prior session cannot replace the newly logged-in user.
- A late `Me` response from the prior account cannot replace the newly logged-in user.
- Rapid account switching shows the new name, avatar, and profile data without reloading.
- GraphQL schema, authentication resolvers, permissions, and UI layout remain unchanged.

## Validation

- `npx vitest run src/context/__tests__/AuthProvider.login-race.test.jsx src/context/__tests__/AuthProvider.test.jsx`
- `npm run check:conflicts`
- `npm run build`

## Out of scope

- Backend authentication contract changes.
- Changing profile-card layout or individual page fetch policies.
