# Manager dashboard performance fix

## Current behavior and root cause

The manager dashboard loads general restaurant data, but the embedded performance panel can fail independently with `FORBIDDEN`. The performance resolver uses `resolveUserRoles`, which does not currently read `roleSlug`, `role.name`, or a string-valued `role`, although those shapes are used by authenticated accounts elsewhere in the application.

The performance summary roster also still filters `Staff.restaurantForStaff`, while the current source of truth for restaurant assignment is active `BrandMembership` scoped to the same brand and restaurant. This can omit valid staff and make the performance dashboard inconsistent with scheduling, payroll, and staff management.

The dashboard visual hierarchy is fragmented: related operational cards are split between the main and side columns, while low-priority analytics compete with orders, staff performance, support requests, and stock warnings.

## End-to-end flow

1. `BrandMembership`, `StaffPerformanceSnapshot`, incidents, and adjustments store scoped performance data.
2. `schedulingPermission.service.js` resolves actor roles and restaurant access.
3. `staffPerformanceReporting.service.js` builds scoped staff summaries.
4. `managerPerformanceDashboard.service.js` returns the manager overview.
5. `useManagerPerformanceDashboard.js` queries the GraphQL operation.
6. `ManagerPerformancePanel.jsx` renders the embedded panel.
7. `Dashboard.jsx` arranges the manager command center.

## Direction

Professional restaurant command center using the existing manager palette: urgent work first, compact operational summary second, primary order and staff monitoring next, and lower-priority analytics grouped last.

## Acceptance criteria

- Manager/admin/HR/accountant role shapes supported by the authenticated user model resolve consistently.
- Existing restaurant access checks remain mandatory.
- Performance summaries use active BrandMembership staff scope for the selected restaurant and brand.
- The embedded performance panel returns empty/healthy data rather than failing for a valid manager account.
- Pending actions and operational KPIs appear before analytic cards.
- Recent orders and staff performance are visually prominent and aligned.
- Support requests and stock warnings are grouped as operational attention items.
- Top dishes and revenue trend are grouped as secondary analytics.
- Existing actions, GraphQL fields, formulas, notifications, and restaurant selection behavior remain unchanged.
- Focused regression tests cover role normalization, membership roster scope, and dashboard hierarchy.

## Out of scope

- Changing performance weights or score formulas.
- Adding a new dashboard API or duplicate query.
- Replacing the manager design system.
- Adding chart libraries, component libraries, or dependencies.

## Validation plan

- Targeted backend role and performance reporting tests.
- Targeted `Dashboard.test.jsx`.
- GraphQL validation, conflict check, and build when a runnable checkout is available.
