# Populate manager dashboard analytics with real data

## Current behavior

The manager dashboard GraphQL contract already exposes `occupancyHeatmap` and `staffPerformance`, and the frontend renders both widgets. However, the `ManagerDashboard` field resolvers return `[]` unconditionally, so both widgets remain in an empty state even when restaurant orders, tables, and performance snapshots exist.

## Root cause

The analytics compatibility resolver replaces the real data boundary with placeholder arrays. It already receives the authorized dashboard parent, including the selected period's trend keys and restaurant ID, so the smallest root-cause fix is to resolve both fields there from the existing models.

## End-to-end flow

1. `Order`, `Table`, and `StaffPerformanceSnapshot` contain the operational data.
2. `managerDashboard` authorizes restaurant access and returns the selected week/month context.
3. The `ManagerDashboard` field resolvers load the scoped analytics rows.
4. The existing GraphQL type exposes the fields without a contract change.
5. `useAnalyst`, `SmartOccupancyHeatmap`, and `StaffPerformance` consume the rows unchanged.

## Files to change

- `cohan-restaurant-backend/graphql/resolvers/analytics/index.js`: replace the two placeholder resolvers with restaurant-scoped occupancy and staff-performance calculations.
- `cohan-restaurant-backend/tests/resolvers/manager-dashboard-analytics.test.js`: verify occupancy averaging, capacity bounds, snapshot deduplication, and output mapping.

## Acceptance criteria

- Restaurants with dine-in orders and active table capacity receive non-empty occupancy heatmap points.
- Occupancy is averaged by weekday/hour across the selected period and capped at 100%.
- Cancelled, failed, draft, takeaway, and delivery orders do not affect table occupancy.
- Staff performance returns the newest overlapping snapshot for each active employee.
- `ordersHandled` comes from the snapshot's real `factors.orderCount`; `efficiency` comes from `finalPerformanceScore`.
- Existing GraphQL schema, Apollo query, and widget markup remain unchanged.

## Out of scope

- Predictive future occupancy.
- Regenerating performance snapshots.
- Changing performance formulas.
- Changing dashboard labels or styling.

## Validation plan

- Run the focused backend Vitest file.
- Run backend lint, tests, GraphQL checks, and build through CI.
- Run frontend contract, build, and smoke checks through CI.
