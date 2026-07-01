# Restaurant access scope

`refRestaurants` is **not** an authorization source.

## User restaurant fields

- `refRestaurants` tracks restaurants a customer has recently accessed. It is used for customer context/history only and must not grant manager or staff access.
- Do not rely on `user.restaurantId` for manager accounts. Manager users do not carry a restaurant ownership list on the user document.
- Staff-style scoped users may use explicit staff scope fields such as `restaurantForStaff` or assigned `restaurantIds` where those fields are intentionally populated.

## Manager restaurant ownership

Manager access to a restaurant is resolved from the restaurant record itself:

- restaurant `_id` must match the requested restaurant;
- Brand-scoped manager access must come from `BrandMembership.role = "manager"` and `BrandMembership.restaurantIds`.
- restaurant `managerId` is legacy/cache fallback only for users without active BrandMembership.

In code, manager scope should flow through `requireRestaurantAccess` / `canAccessRestaurant`. That service checks BrandMembership first and only falls back to `Restaurant.managerId` for legacy users with no active BrandMembership. Do not add `refRestaurants` or customer browsing history as a shortcut for manager authorization.
