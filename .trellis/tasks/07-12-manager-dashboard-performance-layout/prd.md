# Manager dashboard performance and layout fix

## Current behavior and root cause

The manager dashboard renders `ManagerPerformancePanel`, which calls `useManagerPerformanceDashboard`. The hook always sends `restaurantId`, `month`, `year`, and `limit` to `managerPerformanceDashboard`.

The resolver and `managerPerformanceDashboard.service.js` already consume month/year, employee filters, thresholds, and limits, but the GraphQL input only exposes `restaurantId`, `periodStart`, and `periodEnd`. GraphQL variable coercion therefore rejects the dashboard request before the resolver runs, and the UI falls back to `Không thể tải dữ liệu hiệu suất`.

The lower dashboard also relies on `DashboardSynchronized` creating a DOM node, observing mutations, and portalling the staff roster into `.dashboard-side-stack`. Its visual order is split across nested stacks and CSS `display: contents`, which makes the operational hierarchy difficult to maintain.

## End-to-end flow

1. `ManagerPerformanceDashboardInput` in compatibility schema.
2. `staff/query.js` resolver and `managerPerformanceDashboard.service.js` restaurant/role checks.
3. `useManagerPerformanceDashboard` Apollo query.
4. `ManagerPerformancePanel` inside `Dashboard`.
5. `DashboardSynchronized` restaurant-scoped staff roster and dashboard layout.
6. Runtime schema and dashboard component tests.

## Direction

Professional operational command center using the existing manager palette: urgent work first, recent activity and staff context together, then support/alerts/performance, followed by secondary commercial insights.

## Files to change

- `cohan-restaurant-backend/graphql/schema/operationCompatibilityExtras2.graphql`: expose the fields already sent and consumed by the manager performance flow.
- `cohan-restaurant-backend/tests/graphql/staff-performance-schema-runtime.test.js`: validate the real manager dashboard operation.
- `src/components/Dashboard_Manager/Dashboard/Dashboard.jsx`: flatten and reorder the operational grid; accept a restaurant-scoped staff roster slot.
- `src/components/Dashboard_Manager/Dashboard/DashboardSynchronized.jsx`: pass the roster directly and remove portal/MutationObserver insertion.
- `src/components/Dashboard_Manager/Dashboard/Dashboard.scss`: define the shared desktop/tablet/mobile operational grid.
- `src/components/Dashboard_Manager/Dashboard/DashboardSynchronized.scss`: remove portal-only layout rules while retaining manager visual polish.
- `src/components/Dashboard_Manager/Dashboard/Dashboard.test.jsx`: cover the direct roster slot and priority section order.

## Acceptance criteria

- The `ManagerPerformanceDashboard` query validates with `month`, `year`, `fromDate`, `toDate`, `employeeIds`, `lowScoreThreshold`, and `limit`.
- Performance data reaches the existing resolver/service instead of failing input coercion.
- Existing manager/admin/HR/accountant role checks and restaurant scope remain unchanged.
- Dashboard order on desktop is: recent orders + staff roster; support + operational alerts + performance; top dishes + revenue.
- Tablet uses two columns and mobile uses one column without horizontal overflow.
- Staff roster uses the selected accessible restaurant and no longer depends on a portal or DOM mutation observer.
- Existing queue actions, navigation and empty/loading/error states remain intact.

## Out of scope

- Performance formulas, deductions, appeals or snapshot generation.
- Dashboard data aggregation outside the broken performance input contract.
- New design systems, dependencies, charts or backend abstractions.

## Validation plan

- `cohan-restaurant-backend/tests/graphql/staff-performance-schema-runtime.test.js`.
- `src/components/Dashboard_Manager/Dashboard/Dashboard.test.jsx`.
- Frontend/backend conflict checks and build when a runnable checkout is available.
- Browser review at 1440, 1024, 768, 430 and 390 px when available.
