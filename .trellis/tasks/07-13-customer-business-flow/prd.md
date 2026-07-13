# Customer business flow completion

## Goal

Close the remaining manager-side customer workflow gaps after report pages 16–20.

## Acceptance criteria

- Managed customer and guest creation is restaurant-scoped and authorized for admin/manager users with customer update permission.
- Managed creation does not depend on the public registration reCAPTCHA path.
- Direct customer chat and promotion delivery include the selected customer as a participant.
- “All customers” campaigns use the complete restaurant-scoped customer result set rather than only the current page.
- Campaign segments resolve from the restaurant rank configuration.
- Customer activity filters are enforced by the backend query.
- Exact customer IDs are searchable.
- Customer notes are isolated by restaurant.
- Managers with the correct permission can view and restore archived customers.
- List/card totals use persisted total order and spending metrics, not the recent-order sample.
- Cancelled, failed and draft orders do not contribute to customer favorites/recent summaries; fully refunded orders do not increase customer analytics spend.
- Customer rank settings reject duplicate names, duplicate thresholds and configurations without a zero-point base rank.
- Technical errors in customer archive, note and chat flows are converted to user-facing messages.
