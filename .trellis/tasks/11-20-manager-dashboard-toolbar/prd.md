# Manager dashboard toolbar

The title and primary actions sit in a separate card from the dashboard filters and update status. Put the title, branch and period controls, refresh status, and actions in one compact panel using the existing manager palette. Keep actions reachable on narrow screens and display loading, error and no-branch states alongside the controls.

The selected restaurant and period feed the scoped managerDashboard query through useDashboard. The hook polls, refreshes, and navigates to POS using the selected restaurant. Dashboard retains these callbacks and displays the status it receives.

Update Dashboard JSX, dashboard styles and the existing component test. Validate the grouped controls, current callbacks, and status states with focused tests, a production build and a Chromium smoke check using mocked data.

## Verification

- Passed all 20 targeted dashboard and hook tests, GraphQL validation, conflict marker checks, and the production build.
- Checked 390, 430, 768, 1024, and 1440 px in Chromium with mocked data. Verified branch and period selection, refresh with the selected filters, and POS navigation with the selected branch ID.
