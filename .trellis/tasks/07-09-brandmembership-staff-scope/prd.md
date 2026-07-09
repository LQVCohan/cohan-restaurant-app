# BrandMembership staff restaurant scope

## Scope
Use active BrandMembership.restaurantIds as the only runtime source for staff/manager restaurant assignment. Stop reading or writing User.restaurantForStaff in runtime staff flows.

## Constraints
- Keep viewer authorization through existing requireRestaurantAccess/permission guards.
- Do not use refRestaurants for staff scope.
- Keep User.restaurantForStaff DB field only as legacy data unless a migration is added.
- Smallest cross-layer diff that removes mixed source of truth.

## Acceptance criteria
- Staff list/detail/profile and staff-adjacent backend modules derive target staff restaurant membership from BrandMembership.
- createStaff creates/updates BrandMembership and does not set restaurantForStaff.
- Frontend staff management does not query/send/filter by restaurantForStaff or refRestaurants.
- Focused backend/frontend tests cover BrandMembership scope and create mutation payload.
