# Dashboard activity by period

Place revenue and recent orders together after the urgent queues, with a shared period label. Show the dated interval when the dashboard provides the daily series, and keep the operational statistics and best sellers below the period activity. Preserve informative loading, empty, and error states.

The scoped dashboard resolver queries Order by the selected 7 or 30 day period. The resolver supplies the daily trends and recent orders through useDashboard to Dashboard, RevenueChart, and RecentOrders. Generate the daily buckets from the actual query boundaries so sparse order dates stay aligned to the matching day of the previous period.

Update the dashboard markup, chart and layout styles and their targeted tests. Update the existing dashboard resolver and contract test for calendar-aligned trends. Validate with targeted tests, GraphQL checks, a production build, and Chromium with mocked dashboard data.

## Verification

- Passed 14 frontend dashboard tests and 4 backend dashboard contract tests, GraphQL validation, the conflict marker check, and the production build.
- Checked chart labels, order preview, and responsive layout in Chromium at 390, 430, 768, 1024, and 1440 px using mocked GraphQL data. Verified changing from the 7-day to 30-day period updates the interval and revenue. Backend date bucketing was verified with the contract test.
