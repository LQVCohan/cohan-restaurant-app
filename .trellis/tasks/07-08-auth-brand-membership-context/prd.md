# Auth BrandMembership context migration

## Current behavior and root cause

`BrandMembership` is already the runtime authorization source for restaurant scope, but the authenticated client still asks `me` for the legacy `User.restaurantForStaff` field. `AuthProvider` then gives restaurant-scoped users a synthetic one-item restaurant list from that legacy field instead of using `scopedRestaurants`. Staff Order, Kitchen, and the Staff shell also require that legacy value, so removing it from auth without migrating those callers would break the portal.

## End-to-end flow

`User.role` -> login/refresh/`me` auth DTO -> active `myBrandMemberships` + `scopedRestaurants` -> `AuthProvider` business context -> Staff shell / Order / Kitchen restaurant selection -> backend restaurant guards.

## Scope

- Keep `User.role` and `roleName` unchanged for portal and occupational routing.
- Remove `restaurantForStaff` from the auth DTO used by login, refresh, and `me`.
- Replace the split `me` and restaurant queries in `AuthProvider` with one authenticated session query that loads `me`, active `myBrandMemberships`, and `scopedRestaurants`.
- Expose active `brandMemberships` and membership-scoped `restaurants` through `AuthContext`.
- Update Staff shell, Order, and Kitchen to read the first scoped restaurant instead of `user.restaurantForStaff` so the initial migration does not break operational routes.
- Keep backend authorization on existing BrandMembership guards; do not reintroduce frontend-derived access.

## Constraints

- `User.role` remains the source for route and feature-role decisions.
- `BrandMembership` remains the only restaurant authorization source.
- Do not add a new endpoint, dependency, or duplicate business-context store.
- Do not remove the legacy database field or admin editing compatibility in this phase.
- Do not implement a multi-restaurant selector yet; the first accessible restaurant is the temporary active restaurant until the selector phase.

## Acceptance criteria

1. Login, refresh, and `me` auth payloads do not expose `restaurantForStaff`.
2. Authenticated non-customer restaurant options come from `scopedRestaurants` backed by BrandMembership.
3. Active memberships are available from `AuthContext`.
4. Staff Order, Kitchen, and StaffLayout still resolve a restaurant when the user DTO contains no `restaurantForStaff`.
5. `roleName` continues to drive staff occupational navigation.
6. Logout and auth failure clear memberships and restaurant context.
7. Focused auth and provider tests cover the new contract.

## Validation plan

- Run the backend auth/me resolver test.
- Run the AuthProvider component test.
- Run focused StaffLayout, StaffOrderingScoped, and StaffKitchen tests if available.
- Run GraphQL schema validation and frontend build when the environment permits.

## Out of scope

- Removing `restaurantForStaff` from the MongoDB User schema.
- Migrating every staff/payroll/scheduling DTO in one change.
- Building the multi-Brand/multi-restaurant selector.
- Changing BrandMembership role rules or restaurant guard behavior.
