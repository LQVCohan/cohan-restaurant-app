# Schedule next-week registration audit

## Current behavior

The manager action labelled “Mở đăng ký tuần tới” creates a manual availability window in `draft` state but does not open it. The page also mixes unrelated loading/error states, browser/server local time calculations, and DOM scripts that click the React collapse control outside React state.

## Root causes

1. The create path and open path are split while the UI presents them as one action.
2. Availability schedule boundaries are computed with process/browser local `setHours` although the policy timezone is `Asia/Ho_Chi_Minh`.
3. Window mutations do not enforce lifecycle transitions or schedule-publication locking at the backend boundary.
4. Manager query loading is omitted and unrelated auto-schedule lazy-query errors are passed to the registration panel.
5. Two DOM polish utilities mutate labels and auto-click the availability collapse action.
6. Staff scheduling policy query omits probation and contract policy rows used by backend availability validation.

## End-to-end flow

`SchedulingPolicy / AvailabilityRegistrationWindow / SchedulePublication` → availability schedule service and resolver lifecycle guards → availability GraphQL operations → manager registration panel / staff schedule registration → focused tests.

## Scope

- One manager click creates and opens a manual next-week registration window.
- Auto-mode creation remains driven by configured timestamps.
- Canonicalize week boundaries and opening/closing timestamps in the configured IANA timezone.
- Allow only valid window transitions and block reopening when the target schedule is published, active, locked, or closed.
- Clear close metadata when a closed window is legitimately reopened.
- Bind the manager panel to its own window/submission loading and errors.
- Remove DOM-driven availability collapse and context-breaking label replacement.
- Query all employment-type policy rows needed by staff availability UI.
- Keep the existing schedule page structure and visual system.

## Acceptance criteria

- First click on “Mở đăng ký tuần tới” results in an `open` manual window and visible success feedback.
- A failed create/open/close action produces a readable error and leaves the action usable.
- Backend rejects invalid transitions and reopening a period whose schedule is already published/active/locked/closed.
- Window period and deadline timestamps are stable regardless of server timezone.
- Registration panel is not hidden by DOM observers and does not show unrelated auto-schedule errors.
- Staff UI and backend use matching policy rows for full-time, part-time, probation, seasonal, and contract staff.

## Files

- `cohan-restaurant-backend/src/services/availability/availabilityRegistrationSchedule.service.js`
- `cohan-restaurant-backend/graphql/resolvers/availability/mutation.js`
- `cohan-restaurant-backend/tests/resolvers/availability.resolver.test.js`
- `cohan-restaurant-backend/tests/services/availabilityRegistrationSchedule.service.test.js`
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx`
- `src/components/Dashboard_Manager/Schedule/ScheduleManagement.test.jsx`
- `src/utils/scheduleManagerAdminPolish.js`
- `src/utils/scheduleManagerDomPolish.js`
- `src/components/Staff/components/StaffSchedulePage.jsx`
- focused staff test if needed

## Out of scope

- Rewriting the 6,000-line manager schedule component.
- Changing who is permitted to manage registration windows.
- Adding a scheduler/cron implementation for `autoCreateWindow`.
- Reworking payroll, attendance, or leave workflows not directly connected to this defect.

## Validation plan

- Targeted service/resolver/component Vitest.
- GraphQL operation/schema check.
- Conflict check and production build.
- Manager and staff browser smoke at desktop and mobile widths when a runnable checkout is available.
