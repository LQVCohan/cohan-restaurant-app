# Restaurant access scope

`BrandMembership` is the only runtime authorization source for restaurant management scope.

## Account role and BrandMembership role

These are separate dimensions and must not be treated as interchangeable:

- `User.role` controls the portal and system capability set.
- `User.userType` is a legacy/discriminator field. The populated current role takes precedence when detecting a System Admin; `userType` is only a fallback when no role is available.
- `BrandMembership.role` controls the user's authority inside one Brand.
- `BrandMembership.restaurantIds` controls the exact restaurant scope for `manager` and `staff` memberships.

A global `manager` account can legitimately be a Brand `owner` or `admin`, so it will see every restaurant in that Brand. A branch manager must use global role `manager` together with BrandMembership role `manager` and exactly one restaurant ID. A System Admin cannot be restricted to one branch because System Admin access is global.

New Brand membership assignments enforce these compatibility rules:

- Brand `owner` / `admin`: account role must be `manager` or `admin`.
- Brand `manager`: account role must be exactly `manager`.
- Brand `staff`: account role must be a staff/HR/accounting role, not `admin`, `manager`, or `customer`.
- Incompatible legacy memberships can still be deactivated so access can be repaired safely.

## Non-authorization fields

- `refRestaurants` tracks restaurants a customer recently accessed. It is customer context/history only.
- Legacy user fields such as `restaurantId`, `restaurantForStaff`, `restaurantIds`, and `restaurants` must not grant restaurant access.
- `Restaurant.managerId` is not part of the runtime model, GraphQL contract, guards, notification routing, or AI handoff flow.

## BrandMembership scope

- System admins can access all restaurants.
- Active Brand `owner` and `admin` memberships can access every restaurant whose `brandId` matches the membership.
- Active Brand `manager` and `staff` memberships can access only restaurants listed in `membership.restaurantIds` **and** currently belonging to the same membership Brand.
- A stale restaurant ID from another Brand must never grant access.

All restaurant query and mutation guards must flow through `getScopedRestaurantFilter`, `canAccessRestaurant`, `canManageBrand`, or `isBrandOwner`. Manager assignment and membership changes belong to the BrandMembership operations, not restaurant mutations.

The one-time `migrate-restaurant-manager-to-brand-membership.js` script remains available only to convert and clean existing database records before rollout.
