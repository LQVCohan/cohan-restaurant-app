# Design

Use the existing customer identity helper as the shared boundary. Helpers mutate documents in memory and return booleans; callers save once with their transaction session.

- `normalizeRecentRestaurantIds`: validates, dedupes, newest-first, max 12.
- `applyRecentRestaurant`: in-memory recent history mutation.
- `ensureCustomerRestaurant`: in-memory operational membership mutation.
- `applyCustomerRestaurantTouch`: combines both independent options.

GraphQL reads map `$in` restaurant results back to the `refRestaurants` order and filter unpublished/inactive restaurants.
