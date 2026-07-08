# Manager dashboard Brand scope performance

## Current behavior and root cause

`AuthProvider` already loads the authenticated non-customer business context through `myBrandMemberships` and `scopedRestaurants`. The manager shell and dashboard then call `useManagerRestaurantSelection`, which calls `useBrandManagement` and issues `MyBrands` again before `managerDashboard` can start. Brand owners therefore wait for a duplicate Brand/restaurant request waterfall. `useDashboard` also repeats restaurant auto-selection and passes a functional updater into a custom setter that only accepts scalar IDs.

## End-to-end flow

`BrandMembership` / `Restaurant` -> `myBrandMemberships` + `scopedRestaurants` -> `AuthProvider` -> `useBrandManagement` -> `useManagerRestaurantSelection` -> `useDashboard` -> Dashboard UI.

The GraphQL schema, Brand resolver, restaurant scope service, and dashboard resolver remain unchanged because their contracts and authorization behavior are correct for this fix.

## Files changing and why

- `src/hooks/useBrandManagement.js`: derive lightweight Brand options from authenticated context by default; retain `MyBrands` for System Admin and explicit full Brand management.
- `src/components/Dashboard_Manager/Brand/BrandManagement.jsx`: opt into the full Brand query required by the Brand administration form.
- `src/hooks/useDashboard.js`: remove duplicate restaurant auto-selection; the shared Brand selection hook already owns this state.
- `src/hooks/useBrandManagement.scope.test.jsx`: prove that authenticated Brand context skips `MyBrands` while preserving scoped restaurants.

## Acceptance criteria

1. A non-System-Admin Brand owner or manager does not issue `MyBrands` when `AuthContext.brandMemberships` is available.
2. Manager header and dashboard restaurant options still contain only accessible restaurants.
3. System Admin and the Brand management page still use the full `MyBrands` query.
4. Dashboard no longer writes a function string through `setSelectedRestaurantId`.
5. Existing restaurant selection and dashboard tests remain green.

## Constraints

- Keep `BrandMembership` as the authorization source.
- Do not add endpoints, dependencies, stores, providers, or new selection abstractions.
- Preserve System Admin global access and existing localStorage synchronization.
- Do not change dashboard polling or backend analytics without measured evidence that they are the remaining bottleneck.

## Validation plan

- Run the focused Vitest files for `useBrandManagement.scope` and `useDashboard`.
- Run the frontend build if the local environment permits.
- Review the final diff for duplicated Brand scope logic and query-policy regressions.

## Out of scope

- Rewriting `managerDashboard` as MongoDB aggregation.
- Adding database indexes without an execution-plan measurement.
- Changing notification, staff roster, or dashboard polling intervals.
