# Normalize refRestaurants as recent customer history

## Root cause
`refRestaurants` is overloaded as customer recent history, customer-restaurant membership, archive state, and sometimes staff/notification scope.

## Files planned before edit
- Backend user schema/resolvers/customer identity/archive/list/recent restaurant API/notification workflow/migration/tests.
- Frontend RestaurantList and RestaurantDetail operations/tests.

## Acceptance
`refRestaurants` is CUSTOMER-only recent public restaurant history, and operational customer membership uses a separate Customer field.
