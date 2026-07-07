# Restaurant access scope

`BrandMembership` is the authoritative source for Brand-scoped restaurant management.

## Non-authorization fields

- `refRestaurants` tracks restaurants a customer recently accessed. It is customer context/history only.
- `Restaurant.managerId` is not part of the runtime model, GraphQL contract, guards, notification routing, or AI handoff flow.

## BrandMembership scope

- System admins can access all restaurants.
- Active Brand `owner` and `admin` memberships can access every restaurant whose `brandId` matches the membership.
- Active Brand `manager` and `staff` memberships can access only restaurants listed in `membership.restaurantIds` **and** currently belonging to the same membership Brand.
- A stale restaurant ID from another Brand must never grant access.
- When a user has an active BrandMembership, that membership is authoritative and explicit user scope cannot widen it.

## Transitional explicit user scope

Operational accounts that do not yet have an active BrandMembership may continue to use explicit user assignments such as `restaurantId`, `restaurantForStaff`, `restaurantIds`, or `restaurants`. This compatibility scope is ID-based only and never reads `Restaurant.managerId`.

All restaurant query and mutation guards must flow through `getScopedRestaurantFilter`, `canAccessRestaurant`, `canManageBrand`, or `isBrandOwner`. Manager assignment and membership changes belong to the BrandMembership operations, not restaurant mutations.

The one-time `migrate-restaurant-manager-to-brand-membership.js` script remains available only to convert and clean existing database records before rollout.
