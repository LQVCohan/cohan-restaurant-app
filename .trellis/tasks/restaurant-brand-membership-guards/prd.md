# Restaurant BrandMembership guard cleanup

## Current behavior and root cause

Restaurant access is mostly resolved from `BrandMembership`, but runtime code still exposes and accepts `managerId`, keeps a deprecated `restaurantsByManager` query and `updateRestaurantManager` mutation, and falls back to legacy restaurant/user fields when no active membership exists. `canAccessRestaurant` also trusts an assigned restaurant ID before verifying that the membership belongs to the restaurant's current Brand, so a stale assignment can survive a cross-brand move.

## End-to-end flow

`Restaurant` Mongoose schema -> `restaurantScope.service.js` shared guards -> restaurant query/mutation resolvers -> `restaurant.graphql` -> `useRestaurant.js` Apollo operations -> manager UI callers -> resolver/service tests.

## Scope

- Make active `BrandMembership` the only runtime source for non-system-admin restaurant scope.
- Remove `managerId` from the Restaurant model and GraphQL restaurant contracts.
- Remove deprecated `restaurantsByManager` and `updateRestaurantManager` operations and frontend hook support.
- Match manager/staff assignments against the restaurant's current `brandId` before granting access.
- Require valid source and target Brand ownership when moving a restaurant between Brands.
- Replace global manager-role gating in restaurant category mutation with permission plus BrandMembership scope.
- Update focused documentation and tests.

## Constraints

- Reuse existing `BrandMembership`, `requirePermission`, `canManageBrand`, `isBrandOwner`, and `canAccessRestaurant` patterns.
- Do not add dependencies or new authorization abstractions.
- Keep the one-time migration script so production data can be converted and legacy database fields/indexes can be removed safely.
- Do not change unrelated `managerId` fields used by leave, staffing, or other domains.

## Acceptance criteria

1. Restaurant GraphQL schema no longer accepts or returns direct manager assignment and no longer exposes manager-specific restaurant operations.
2. Restaurant runtime model and resolvers no longer read or write `Restaurant.managerId`.
3. Users without active BrandMembership receive no restaurant management scope, except system admins.
4. Owner/admin receive Brand-wide scope; manager/staff receive only assigned restaurants in the same current Brand.
5. Moving a restaurant between Brands is denied unless the caller is a system admin or owner of both source and target Brands.
6. Focused service/resolver tests cover the new-only flow and stale cross-brand assignments.

## Validation plan

- Run the targeted Vitest files for restaurant scope, restaurant query scope, and restaurant mutation access.
- Run the GraphQL schema check.
- Run broader backend tests only if targeted checks reveal shared-contract failures.

## Out of scope

- Executing the production data migration.
- Removing unrelated domain fields named `managerId`.
- Redesigning Brand Management UI or global role routing.
