# Manager orders, phase 1

Direction: Lead the filtered order list with a compact sage heading, add a shortcut above the existing metrics, and reuse the existing actionable cards.

The list currently uses one chronological sequence. Pending orders and active orders over the configured warning threshold can be missed. Create one priority group with a count, followed by the remaining orders. Apply existing search, type, status, date and sort settings. Label long waits and remote staff confirmations on the cards. Advance waiting time without network requests. Preserve the kitchen display and existing creation, payment, and history flows.

Order model and scoped ordersByRestaurantNow resolver supply the restaurant, status, type, createdAt and source metadata. The Apollo query and socket refresh feed the existing filtered active list. Cards keep using updateOrderStatus and the scoped confirmIncomingOrder and rejectIncomingOrder mutations, with existing permission and proof guards and reject reason validation. No contract changes.

- OrderManagementCore.jsx partitions and renders the current filtered list with stable card keys.
- components/OrderCard.jsx and orderWaitTime.js share the wait calculation and display explicit reasons.
- OrderManagement.scss styles the heading and wait indicator.
- OrderManagement.test.jsx verifies grouping, filter scope and kitchen behavior.
- Validate with targeted order Vitest, GraphQL validation, production build and responsive browser smoke with mocked orders.

## Verification

- Conflict markers and GraphQL checks passed, including 740 frontend operations.
- Order area: 43 passed and two pre-existing source-text discount tests failed. Reproduced both on the untouched base commit. The 17 focused page and card tests passed after adding the shortcut.
- Production build passed.
- Chromium with mocked GraphQL passed at 390, 768, 1024 and 1440 px. Verified no document overflow, keyboard jump and focus, unique card order, status labels, and correct restaurant and order inputs for confirmation and rejection. Live backend mutations and the full repository suite were outside this check.
