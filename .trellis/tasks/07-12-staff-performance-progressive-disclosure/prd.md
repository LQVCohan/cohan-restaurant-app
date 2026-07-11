# Compact staff performance page

## Current behavior and root cause

`StaffLayout` renders a route title/description and `StaffPerformancePage` renders a second oversized hero for the same page. The first viewport then contains five tall KPI cards, timeline/incidents, full adjustment history, and the complete appeal form. Secondary actions occupy permanent space even when there are no incidents or adjustments.

The data contract is not the cause. `useStaffPerformanceView` reads summary, timeline, adjustments and incidents through the existing staff performance operations. `usePerformanceIncidentAppeals` and `createPerformanceIncidentAppeal` preserve employee/restaurant scope and validation in the service.

## End-to-end flow

1. Staff performance and appeal compatibility schema.
2. Staff resolver/service permission and appeal validation.
3. `useStaffPerformanceView` and `usePerformanceIncidentAppeals` Apollo operations.
4. `StaffPerformancePage` summary, timeline, incidents and appeal action.
5. `StaffPerformancePage.test.jsx` layout/interaction regression coverage.

## Direction

Compact operational dashboard using the existing sage palette: one page title, shorter KPI group, timeline and related events visible, adjustment history and appeal form disclosed in an accessible right drawer.

## Files to change

- `src/layouts/StaffLayout.jsx`: add a route class so the duplicate shell heading can be suppressed only on `/staff/performance`.
- `src/components/Staff/StaffPerformance/StaffPerformancePage.jsx`: add contextual actions and one reusable drawer; keep mutations and form payload unchanged.
- `src/components/Staff/StaffPerformance/StaffPerformance.scss`: compact page rhythm, route-specific shell treatment and responsive drawer.
- `src/components/Staff/StaffPerformance/StaffPerformancePage.test.jsx`: cover default compact state and drawer opening.

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

## Validation plan

- Targeted `StaffPerformancePage.test.jsx`.
- Frontend conflict check and build when a runnable checkout is available.
- Manual browser review at desktop and mobile widths when available.
