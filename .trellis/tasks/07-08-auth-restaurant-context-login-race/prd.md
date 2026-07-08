# Auth restaurant context login race

## Current behavior and root cause

`AuthProvider.logout` clears local auth state immediately and starts `apolloClient.clearStore()` without retaining its promise. The route guard can therefore show `/login` while that reset is still running. If the user signs in again quickly, `AuthBusinessContext` starts loading `myBrandMemberships` and `scopedRestaurants`, but the previous account's pending `clearStore()` can cancel or clear that new query. The provider then has an authenticated user with an empty restaurant context until a full page reload starts the query again.

The backend contract is not the cause: `scopedRestaurants` resolves through `getScopedRestaurantFilter`, which uses active `BrandMembership` records and preserves system-admin, owner/admin, manager, and staff scope rules.

## End-to-end flow

`BrandMembership model -> getScopedRestaurantFilter -> scopedRestaurants resolver -> AuthBusinessContext Apollo query -> AuthProvider restaurants -> useBrandManagement/useManagerRestaurantSelection -> manager and staff UI`.

The failing lifecycle is:

`logout -> Apollo clearStore still pending -> route reaches login -> explicit login -> AuthBusinessContext starts -> old clearStore finishes and interrupts the new account query`.

## Scope

- Retain the current Apollo client and authenticated business-context query.
- Track the pending account-cache reset started by logout.
- Make an explicit login wait for that reset before publishing the new token and user to `AuthContext`.
- Add a focused regression test for logout followed immediately by login, proving the new session and restaurant context are restored after the reset completes.

## Files to change

- `src/context/AuthProvider.jsx`: serialize the pending Apollo account reset with the next login.
- `src/context/__tests__/AuthProvider.login-race.test.jsx`: reproduce and lock the rapid account-switch behavior.

## Constraints

- Do not change GraphQL schema, restaurant resolver, BrandMembership guards, or restaurant selection rules.
- Do not add a dependency, cache layer, retry abstraction, timeout, or duplicate business-context store.
- Keep local logout state clearing immediate so protected content disappears at once.
- Cache-reset failure must not permanently block login.

## Acceptance criteria

1. Logout still clears token, user, memberships, restaurants, cart, and manager workspace state immediately.
2. A login started while the previous Apollo `clearStore()` is pending does not publish the new authenticated session early.
3. After the reset settles, the new login completes and `AuthBusinessContext` can populate memberships and restaurants without a page reload.
4. A rejected cache reset is swallowed as before and does not prevent the next login.
5. Existing login, logout, restore, and business-context tests remain valid.

## Validation plan

- `npx vitest run src/context/__tests__/AuthProvider.login-race.test.jsx src/context/__tests__/AuthProvider.test.jsx`
- `npm run check:conflicts`
- `npm run build` when available

## Out of scope

- Backend authorization or BrandMembership migrations.
- Adding automatic network retry for unrelated transient GraphQL failures.
- Changing active Brand/restaurant selection behavior.
