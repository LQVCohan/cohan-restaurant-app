# Manager dashboard Brand scope performance

## Current behavior and root cause

`AuthProvider` already loads the authenticated non-customer business context through `myBrandMemberships` and `scopedRestaurants`. The manager shell and dashboard then call `useManagerRestaurantSelection`, which called `useBrandManagement` and issued `MyBrands` again before `managerDashboard` could start. Brand owners therefore waited for a duplicate Brand/restaurant request waterfall. `useDashboard` also repeated restaurant auto-selection and passed a functional updater into a custom setter that only accepts scalar IDs.

## End-to-end flow

`BrandMembership` / `Restaurant` -> `myBrandMemberships` + `scopedRestaurants` -> `AuthProvider` -> `useBrandManagement` -> `useManagerRestaurantSelection` -> `useDashboard` -> Dashboard UI.

The GraphQL schema, Brand resolver, restaurant scope service, and dashboard resolver remain unchanged because their contracts and authorization behavior are correct for this fix.

## Files changed and why

- `src/hooks/useBrandManagement.js`: add a lightweight mode that derives Brand options from authenticated context while keeping the existing full `MyBrands` query as the default for direct consumers.
- `src/hooks/useManagerRestaurantSelection.js`: opt manager scope selection into the lightweight authenticated-context mode.
- `src/hooks/useDashboard.js`: remove duplicate restaurant auto-selection; the shared Brand selection hook already owns this state.
- `src/hooks/useBrandManagement.scope.test.jsx`: prove that authenticated Brand context skips `MyBrands` while preserving scoped restaurants.

## Acceptance criteria

1. A non-System-Admin Brand owner or manager does not issue `MyBrands` through manager restaurant selection when `AuthContext.brandMemberships` is available.
2. Manager header and dashboard restaurant options still contain only accessible restaurants.
3. System Admin and direct Brand management consumers still use the full `MyBrands` query by default.
4. Dashboard no longer writes a function string through `setSelectedRestaurantId`.
5. Existing restaurant selection and dashboard tests remain compatible with the shared selection hook.

## Constraints

- Keep `BrandMembership` as the authorization source.
- Do not add endpoints, dependencies, stores, providers, or new selection abstractions.
- Preserve System Admin global access and existing localStorage synchronization.
- Do not change dashboard polling or backend analytics without measured evidence that they are the remaining bottleneck.

## Validation

- Added a focused hook test covering context reuse and `MyBrands` skipping.
- Reviewed the final diff for duplicate Brand requests, scope filtering, and direct Brand-management compatibility.
- Focused Vitest and frontend build were not run because this connector session has no checked-out repository/runtime; GitHub reported no workflow run or commit status for the change.

## Out of scope

- Rewriting `managerDashboard` as MongoDB aggregation.
- Adding database indexes without an execution-plan measurement.
- Changing notification, staff roster, or dashboard polling intervals.
