# Manager dashboard states

The dashboard uses several unrelated loading and empty treatments. The dashboard query can also fail while statistics fall back to zero or best sellers fall back to an empty list. Use a shared visual treatment, preserve specific messages and actions, and make errors distinct from successful empty results. Keep the roster and performance query states independent of the dashboard query.

The scoped managerDashboard GraphQL request supplies Apollo state through useDashboard. Dashboard and its queue, revenue, recent order, statistics and best seller components consume that state. Roster and performance have separate requests. Use one column on phones and two period cards and two side priority cards on tablet.

Update dashboard components, their styles, the performance summary presentation and focused tests. Validate with Vitest, build and Chromium with mocked data.

## Verification

- Passed 29 targeted frontend tests, GraphQL validation, conflict marker checks, and the production build.
- Chromium passed at 390, 430, 768, 769, 1024, and 1440 px with mocked data. Verified loading, successful empty results, dashboard error, successful retry, responsive columns, and readable order codes.
