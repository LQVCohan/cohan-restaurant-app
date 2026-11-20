# Manager orders, phase 2

One compact control surface with branch, search, order status, channel, sort, date range and actions. Show the count and status breakdown for the visible results in the same surface. The existing header and toolbar split common controls. The old KPI cards count the raw branch payload even when the list excludes paid or closed orders or applies additional filters.

The Order model provides restaurant, status, payment and createdAt. The scoped ordersByRestaurantNow resolver feeds Apollo; the shared branch selection hook persists and broadcasts selection. The page filters the active branch rows before priority grouping and CSV export. Derive the summary from the same visible rows, respect the existing pagination limit and flag it when more rows exist. Preserve the existing order actions and kitchen controls.

- OrderManagementCore.jsx consolidates controls and derives counts.
- OrderManagement.scss lays out the order controls using shared manager tokens and a two-column narrow layout.
- OrderManagement.test.jsx verifies search, filter, reset, and counts for visible active orders.
- Validate component tests, GraphQL, build, and browser smoke for branch selection and responsive layout.

The browser review found the fixed future-order action covering sorting. Move its existing modal and detail action into OrderManagementCore.jsx, simplify the entry point re-export, and remove the obsolete OrderFutureOrdersDock component and stylesheet.

## Verification

- 43 order tests passed. The discount metadata source assertions, with two pre-existing failures reproduced in phase 1, were excluded. The full repository suite was not run.
- Conflict scan and GraphQL schema and operations passed, including 740 static frontend operations. No live backend was used.
- Chromium with mocked GraphQL passed at 375, 390, 430, 768, 1024, and 1440 px, plus dark mode at 390 px. Verified the responsive layout, active filter counts, empty results, reset, scoped branch switching with the search preserved, and the future-orders modal.
- Production build passed after the final responsive changes.
