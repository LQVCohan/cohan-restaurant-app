# Normalize refRestaurants as customer recent history

## Current behavior
`refRestaurants` was overloaded as viewed/recent restaurants, customer-restaurant operational membership, archive state, and legacy staff/reviewer scope fallback. Authenticated customers who created orders or reservations could skip the operational membership update, while a customer who only viewed a restaurant could be treated as a restaurant customer.

## Root cause
One base User field carried multiple business meanings. The earliest shared boundary is the customer identity/order/reservation flow: real transactions must write operational membership, while viewing a restaurant must only write recent history.

## Business terminology
- `refRestaurants`: CUSTOMER-only recent restaurant history, newest first, max 12, public/active restaurants only when read.
- `customerRestaurants`: Customer discriminator field for operational customer-restaurant relationship created by real business events such as order/reservation.
- Staff/manager scope: `restaurantForStaff` for modules that truly use direct assignment; BrandMembership for brand/restaurant authorization and reviewer routing.
- Archive state: `archivedRestaurants` marker plus `customerRestaurants` membership removal; never recent history.

## In scope
- User/Customer schema comments and Customer discriminator membership field.
- Customer identity helper, order user resolution, reservation creation, recent restaurant GraphQL API.
- Customer list/export/analytics/archive and notification reviewer lookup.
- Customer RestaurantList/RestaurantDetail recent-history UI.
- Dry-run migration for legacy data normalization.
- Behavior tests for helper, order, archive, recent query, notification, migration and frontend contract guards.

## Out of scope
- Changing order/reservation status, table conflict, deposit, wallet, loyalty, role or BrandMembership semantics.
- Running production migration writes.
- Adding collections, dependencies or future-proof abstractions.

## Flow contract
- View restaurant -> `recordRecentRestaurant` -> `refRestaurants` only.
- Order/reservation success -> shared customer touch -> `refRestaurants` + `customerRestaurants` in the same transaction/session when available.
- Customer list/export/analytics -> `customerRestaurants`.
- Archive -> pull `customerRestaurants`, add `archivedRestaurants`; restore reverses that; `refRestaurants` is unchanged.
- Notification reviewer routing -> active BrandMembership for the restaurant brand plus system admins; no `refRestaurants`.

## Authorization contract
`refRestaurants` is never an authorization or scope source. Legacy `refRestaurants(userId)` query is removed after all callers were migrated to `myRecentRestaurants`.

## Notification contract
Reviewers are resolved from active BrandMembership scoped to the restaurant's brand and restaurantIds. System admins remain included as global reviewers. Inactive memberships do not receive reviewer notifications.

## Migration safety
`normalizeRefRestaurantsRecentHistory.js` defaults to `--dry-run` usage, verifies `MONGO_DB` when set, prints database/collection/scanned/modified aggregate stats, unsets non-customer refs, rebuilds recent history from Order/Reservation, falls back to normalized legacy refs, and never changes account status, role, loyalty, order or reservation documents.

## Frontend wording
Recent section copy is: “Đã xem gần đây”, “Quay lại nhà hàng bạn vừa xem”, “Mở lại nhanh mà không cần tìm kiếm lại.” The UI no longer derives recent restaurants from orders/reservations.

## Acceptance criteria
- `refRestaurants` is recent history only, newest first, unique, max 12.
- Authenticated order and reservation flows update both `refRestaurants` and `customerRestaurants` only on successful transaction paths.
- Viewing a restaurant never creates operational membership.
- Customer list/archive/statistics never filter or mutate by `refRestaurants`.
- Reviewer/staff routing and authorization do not use `refRestaurants`.
- Migration detects raw dirty arrays, duplicates, missing restaurants, archived memberships and over-limit history in dry-run.
- Behavior tests cover helper/order/reservation-equivalent membership touch/recent query/archive/notification/migration/frontend contracts.

## Validation commands
- `npm run check:conflicts`
- `npm run check:graphql`
- `npm --prefix cohan-restaurant-backend test`
- `npm run test:unit`
- `npm run test:component`
- `npm run build`
- `node cohan-restaurant-backend/scripts/migration/normalizeRefRestaurantsRecentHistory.js --dry-run` only against a configured test DB.
