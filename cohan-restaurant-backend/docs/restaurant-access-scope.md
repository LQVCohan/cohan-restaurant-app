# Restaurant access scope

`refRestaurants` is **not** an authorization source.

## User restaurant fields

- `refRestaurants` tracks restaurants a customer has recently accessed. It is used for customer context/history only and must not grant manager or staff access.
- Do not rely on `user.restaurantId` for manager accounts. Manager users do not carry a restaurant ownership list on the user document.
- Staff-style scoped users may use explicit staff scope fields such as `restaurantForStaff` or assigned `restaurantIds` where those fields are intentionally populated.

## Manager restaurant ownership

Manager access to a restaurant is resolved from the restaurant record itself:

- restaurant `_id` must match the requested restaurant;
- restaurant `managerId` must match the authenticated manager user id.

In code, manager scope should continue to flow through `requireRestaurantAccess` / `managerOwnsRestaurant`, which checks `Restaurant.exists({ _id: restaurantId, managerId })`.
Do not add `refRestaurants` or customer browsing history as a shortcut for manager authorization.
