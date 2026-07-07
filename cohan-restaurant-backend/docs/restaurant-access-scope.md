# Restaurant access scope

`BrandMembership` is the only runtime authorization source for restaurant management scope.

## Non-authorization fields

- `refRestaurants` tracks restaurants a customer recently accessed. It is customer context/history only.
- Legacy user fields such as `restaurantId`, `restaurantForStaff`, `restaurantIds`, and `restaurants` must not grant restaurant access.
- `Restaurant.managerId` is not part of the runtime model or GraphQL contract.

## BrandMembership scope

- System admins can access all restaurants.
- Active Brand `owner` and `admin` memberships can access every restaurant whose `brandId` matches the membership.
- Active Brand `manager` and `staff` memberships can access only restaurants listed in `membership.restaurantIds` **and** currently belonging to the same membership Brand.
- A stale restaurant ID from another Brand must never grant access.

All restaurant query and mutation guards must flow through `getScopedRestaurantFilter`, `canAccessRestaurant`, `canManageBrand`, or `isBrandOwner`. Manager assignment and membership changes belong to the BrandMembership operations, not restaurant mutations.

The one-time `migrate-restaurant-manager-to-brand-membership.js` script remains available only to convert and clean existing database records before rollout.
