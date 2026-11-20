# Manager dashboard priorities

Support requests and low-stock alerts sit below the operating statistics and recent activity. Group pending orders, reservations, support requests, and low-stock alerts immediately after the dashboard filters. Keep the existing sage palette, make positive counts easy to scan, and use the existing direct queue actions. Show the inventory link only when ManagerLayout grants inventory access.

The restaurant-scoped dashboard resolver supplies Order, Reservation, and stock results through useDashboard. Dashboard renders these results and routes queue writes through useDashboardActionQueue, which handles mutations and refreshes. ManagerLayout supplies the inventory permission and handles navigation. Counts reflect the items loaded by the existing dashboard query.

Update Dashboard and its styles and existing test for placement and inventory navigation. Pass the inventory capability through ManagerLayout and DashboardSynchronized. Move the stock wording into accessible JSX and remove its CSS text replacement. Update the existing queue headers for loading and error counts and remove obsolete dashboard grid positions.

Validate with targeted dashboard tests, GraphQL validation, and the production build. Check responsive layout with Chromium when available. Backend data contracts and the broader performance dashboard work are outside this task.

## Verification

- Passed all 13 dashboard tests, GraphQL schema and operation validation, the conflict marker check, and the production build.
- Verified all four work groups, readable reservation action labels, and absence of horizontal overflow in Chromium at 390, 430, 768, 1024, and 1440 px. Opened inventory with a mock manager account. Queue writes against a live backend were outside this check.
