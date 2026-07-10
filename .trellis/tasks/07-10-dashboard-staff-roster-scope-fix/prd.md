# Dashboard staff roster scope fix

## Current behavior and root cause

`DashboardStaffRoster` calls `staffList(restaurantId, employmentStatus)` through the synchronized dashboard portal. The backend correctly checks `requireRestaurantAccess(ctx, restaurantId)` before reading staff, so a stale restaurant id produces `FORBIDDEN_SCOPE`.

`DashboardSynchronized` initializes its local `restaurantId` from `readDashboardRestaurantId()` before validating that id against the current `AuthContext.restaurants`. After switching account, brand, or restaurant scope, the stored id can belong outside the current BrandMembership scope while the main dashboard has already moved to the accessible restaurant.

## End-to-end flow

`BrandMembership` / `Restaurant` -> `scopedRestaurants` -> `AuthProvider.restaurants` -> `DashboardSynchronized` portal restaurant id -> `DashboardStaffRoster` GraphQL query -> `staffList` resolver -> `requireRestaurantAccess`.

## Files changed and why

- `src/components/Dashboard_Manager/Dashboard/DashboardSynchronized.jsx`: only pass a restaurant id to the roster when it exists in the authenticated accessible restaurant list; fall back to the first accessible restaurant instead of trusting localStorage blindly.

## Acceptance criteria

1. A stale `manager.dashboard.selectedRestaurantId` no longer makes `DashboardStaffRoster` call `staffList` with an out-of-scope restaurant id.
2. The staff roster still follows dashboard restaurant change events when the emitted id is accessible.
3. The staff roster stays hidden until an accessible restaurant id is available.
4. No backend authorization bypass is added.

## Validation plan

- Run focused dashboard / AuthProvider tests if a local checkout is available.
- Run frontend build or component tests if the environment permits.

## Out of scope

- Changing backend restaurant guards.
- Adding a new restaurant selector.
- Changing dashboard polling or staff roster query fields.
