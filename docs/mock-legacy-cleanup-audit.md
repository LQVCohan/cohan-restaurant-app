# Mock/Legacy Cleanup Audit

## Removed mock/legacy files
- `src/components/Customer/RestaurantMenu/useMockMenu.js`
- `src/components/Customer/RestaurantMenu/menuData.js`
- `src/components/Staff/data/mockData.js`
- `src/components/Dashboard_Manager/Dashboard/components/Chart/Chart.jsx`
- `src/components/Dashboard_Manager/Dashboard/components/Chart/index.js`
- `src/components/Dashboard_Manager/Dashboard/components/Layout/DashboardLayout.jsx`
- `src/components/Dashboard_Manager/Review/ReviewManagement.html`
- `src/components/Dashboard_Manager/Salary/SalaryManagement.html`
- `src/misc/legacy/New Text Document.txt`
- `src/hooks/useEmployees.js` (unused sample-data hook)

## Runtime paths now using real data
- Manager dashboard runtime uses `useDashboard` + `RevenueChart` fed by GraphQL dashboard data.
- Staff ordering runtime keeps GraphQL-driven data flow from `StaffOrdering.jsx` and no longer falls back to mock constants in child components.
- Manager review runtime uses React `ReviewManagement.jsx` (GraphQL-backed), not static demo HTML.
- Payroll runtime in manager layout points to `PayrollManagement` React module.

## Test-only mocks
- Unit test mocks under `*.test.*` and `__tests__` were preserved.

## Remaining known limitations
- One scoped TODO comment remains in schedule management for future `ScheduleIncident` backend service integration; it is specific and not a generic mock/fake marker.

## Verification commands run
- `npm run lint`
- `npm test`
- `npm run build`
- `rg -n "MOCK_|sampleEmployees|sampleReviews|Sample data for demonstration|Mock fetch|data_sdk|element_sdk" src cohan-restaurant-backend`
- `rg -n "TODO|FIXME" src cohan-restaurant-backend`
