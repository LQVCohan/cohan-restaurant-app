# Repair business analytics data loading

## Current behavior and root cause

The business analytics page requests the core manager dashboard together with demand forecasting, staff scheduling, menu engineering, smart promotions, feedback, occupancy, performance and customer operations data.

Several independent faults make sections appear empty or make the whole screen fail:

1. `analytics.ManagerDashboard` implements the feedback, occupancy and staff-performance field resolvers, but the root resolver map does not register that type resolver object. GraphQL therefore resolves those fields from the parent object, where they do not exist, and returns null values.
2. `useAnalyst` selects the first restaurant from `AuthContext` instead of using the shared manager restaurant selection. The analytics screen can query a different restaurant from the manager header and cannot reject a late response from the previous restaurant.
3. The main Apollo document combines core dashboard data and optional assistants with the default `errorPolicy`. One optional field error causes Apollo to discard otherwise valid core data and the page renders one generic failure state.
4. The customer-request query requires `order.read`, but the analytics page is accessible with `report.read`. Report-only users therefore make a query they cannot authorize.
5. The page refresh action only refetches the main document, not the separate customer-request queue.

## End-to-end flow

`Order/Review/Table/StaffPerformanceSnapshot/StockItem and analytics services` -> `managerDashboard, analytics, staff and order resolvers` -> `GraphQL schema` -> `useAnalyst` -> `ManagerAnalyst` -> KPI, revenue, demand, staffing, menu, promotion, feedback, occupancy and action-center widgets.

## Scope

- Register the existing `analytics.ManagerDashboard` field resolvers in the root resolver map.
- Make `useAnalyst` use `useManagerRestaurantSelection` as the single restaurant-scope source.
- Request and validate `managerDashboard.restaurantId` so stale responses are not rendered after switching branches.
- Preserve usable core data when an optional analytics field fails by using Apollo partial-data behavior.
- Include staff scheduling only for users with `shift.read`.
- Skip the customer-request query for users without `order.read`.
- Make the public refresh function update both the analytics document and the operations queue when permitted.
- Add focused backend contract and frontend hook regression tests.

## Acceptance criteria

1. `feedbackSummary`, `feedbackItems`, `occupancyHeatmap` and `staffPerformance` resolve through the implemented restaurant-scoped field resolvers.
2. The analytics page always follows the shared manager-selected restaurant.
3. Data whose returned `restaurantId` differs from the current selection is not exposed to widgets.
4. Failure of an optional assistant does not erase valid KPI, trend, order, inventory, feedback or occupancy data.
5. A report-only user does not call the `customerServiceRequests` query and does not receive a false operations error.
6. Staff scheduling is omitted when the user lacks `shift.read`, while the remaining analytics still load.
7. Refresh updates all queries that the current user is allowed to run.
8. Existing GraphQL schema, formulas, AI services, restaurant authorization and widget markup remain unchanged.

## Out of scope

- Changing revenue, trend, forecast, scheduling, menu-engineering, promotion or performance formulas.
- Regenerating missing operational data.
- Redesigning the analytics UI.
- Adding new permissions, schema fields, dependencies or background jobs.

## Validation plan

- `npm --prefix cohan-restaurant-backend test -- tests/dashboard/manager-dashboard-contract.test.js tests/resolvers/manager-dashboard-analytics.test.js`
- `npx vitest run src/hooks/useAnalyst.test.js src/components/Dashboard_Manager/Analyst/ManagerAnalyst.test.jsx`
- `npm run check:graphql`
- `npm run build`
- Manual review while switching restaurants and while one optional resolver returns a GraphQL error.
