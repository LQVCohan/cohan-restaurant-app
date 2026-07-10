# Stabilize frontend component tests

## Current behavior

The frontend component job initially failed in `TableManagement.test.jsx`. After those blockers were removed, the full changed-code suite exposed additional stale assertions, missing test-runtime exports, async storage leaks, an unstable Apollo mock, and a production-only transform that Vitest did not share.

## Root causes

1. `TableManagement.test.jsx` imported `AuthContext`, reset the module registry, then dynamically imported `TableManagement`, creating two context instances.
2. Several assertions still used older labels or queried the whole page instead of the relevant modal.
3. `Modal.jsx` left a delayed focus timer open in jsdom.
4. The local `lucide-react` test shim did not export `MonitorCog`.
5. `EmployeeFormModal.test.jsx` used jsdom Storage for draft lifecycle checks, producing storage-event timers.
6. `StaffPerformancePage.jsx` relies on a Vite transform for `getMonthRange`; Vitest did not run the same transform or app bootstrap formatter installer.
7. jsdom dispatches native Web Storage events with a zero-delay timer, which the leak detector could snapshot before completion.
8. `TableActionsModal.customer.test.jsx` recreated Apollo suggestion functions on each render and asserted before the asynchronous customer snapshot hydrated.

## End-to-end flows checked

- `AuthContext restaurants -> TableManagement selectedRestaurantId -> useFloorManagement/useTableManagement restaurantId -> rendered actions -> assertions`.
- `StaffPerformancePage source -> shared Vite transform -> Vitest transform -> global performance formatters -> layout test`.
- `Table customer query -> modal hydration -> customer form -> upsert mutation -> POS refresh callback`.
- `Browser Storage mutation -> jsdom storage event -> Vitest open-handle detection`.

No GraphQL schema, resolver, mutation, permission, table workflow, customer deletion, order setting, staff form, review, or POS business contract was changed.

## Files changed

- `src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
  - Reuse one component/context module instance and assert the compact current UI.
- `src/components/common/Modal.jsx`
  - Focus immediately in jsdom while retaining delayed browser focus.
- `src/components/Customer/Profile/components/SecuritySettings.test.jsx`
  - Use the current deletion-confirmation label.
- `src/lib/lucideReactShim.jsx`
  - Export `MonitorCog` from the existing test/build shim.
- `src/components/Dashboard_Manager/Staff/components/modals/EmployeeFormModal/EmployeeFormModal.test.jsx`
  - Use timer-free in-memory draft storage.
- `src/components/Dashboard_Manager/Sidebar.test.jsx`
  - Assert current shared role-display labels.
- `vite.config.js` and `vitest.config.js`
  - Reuse the existing staff-performance month-range transform in both runtimes.
- `src/test/setup.js`
  - Install the same performance formatter bootstrap as the app and allow native zero-delay storage events to settle before leak detection.
- `src/components/Customer/RestaurantDetail/components/ReviewsSection/ReviewsSection.flow.test.jsx`
  - Scope validation lookup to the write-review dialog.
- `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.customer.test.jsx`
  - Keep customer-search mocks stable and wait for snapshot hydration before asserting or saving.

## Acceptance criteria

- Manager branch selection reaches table and floor hooks with the current restaurant ID.
- Current modal, compact action, role, and deletion labels are tested without changing production wording.
- Hi-level component tests have no modal-focus or Storage timer leaks.
- Staff performance tests use the same month-range and formatting runtime as production.
- Table customer tests restore and persist the complete customer schedule snapshot.
- Backend checks and frontend conflict, lint, unit, Menu RBAC, component, build, and smoke checks pass.

## Validation result

GitHub Actions run `29107663935` passed:

- backend lint, tests, Menu RBAC, and build;
- frontend conflict-marker check, lint, unit tests, Menu RBAC;
- changed-code component tests with async leak detection;
- production build;
- Playwright smoke tests.

No local test run was performed because this session operated through the GitHub connector rather than a checked-out dependency workspace.
