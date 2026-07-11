# Compact staff performance page

## Current behavior and root cause

`StaffLayout` already renders the route title and description, while `StaffPerformancePage` rendered a second oversized hero for the same page. The first viewport then contained five tall KPI cards, timeline/incidents, full adjustment history, and the complete appeal form. Secondary actions occupied permanent space even when there were no incidents or adjustments.

The data contract is not the cause. `useStaffPerformanceView` reads summary, timeline, adjustments and incidents through the existing staff performance operations. `usePerformanceIncidentAppeals` and `createPerformanceIncidentAppeal` preserve employee/restaurant scope and validation in the service.

## End-to-end flow

1. Staff performance and appeal compatibility schema.
2. Staff resolver/service permission and appeal validation.
3. `useStaffPerformanceView` and `usePerformanceIncidentAppeals` Apollo operations.
4. `StaffPerformancePage` summary, timeline, incidents and appeal action.
5. `StaffPerformancePage.test.jsx` layout/interaction regression coverage.

## Direction

Compact operational dashboard using the existing sage palette: one shared page title, shorter KPI group, timeline and related events visible, adjustment history and appeal form disclosed in an accessible right drawer.

## Implemented files

- `src/components/Staff/StaffPerformance/StaffPerformancePage.jsx`: removed the duplicated inner hero, added contextual actions and one reusable drawer while keeping the mutation payload unchanged.
- `src/components/Staff/StaffPerformance/StaffPerformance.scss`: compacted page rhythm, KPI surfaces and panels; added responsive drawer, focus states and reduced-motion handling.
- `src/components/Staff/StaffPerformance/StaffPerformancePage.test.jsx`: covers the compact empty state and progressive disclosure for history and appeals.

`src/layouts/StaffLayout.jsx` was inspected but intentionally left unchanged: retaining its existing route heading and deleting the duplicate page hero is the smaller correct fix.

## Acceptance criteria

- Only one performance page title is visible.
- The initial viewport prioritizes the period, KPI summary, timeline and related events.
- Adjustment history is not rendered visibly until requested.
- The appeal form is not rendered visibly until requested and remains preselected when opened from an incident.
- Empty periods do not show a large unusable appeal form.
- Drawer closes by close button, backdrop and Escape, has accessible dialog labelling, and works on phone widths.
- Existing GraphQL fields, mutation payloads, permission checks, notifications and score logic remain unchanged.

## Out of scope

- Performance formula or scoring changes.
- Backend/schema changes.
- Manager performance screens.
- New component libraries or dependencies.

## Validation

- Static end-to-end review completed against schema, service, Apollo hooks, page and tests.
- Targeted test, conflict check, build and browser smoke were not executed because this connector session has no runnable repository checkout.
- No GitHub workflow or combined status was attached to implementation commit `ad4e33cabe9dfe64edf465b548ca34341ad58af7` at completion time.
