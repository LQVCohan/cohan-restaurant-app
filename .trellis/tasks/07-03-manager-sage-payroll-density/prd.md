# Finish manager sage palette and compact payroll readiness

## Observed problems

Screenshots after the first palette pass show that the manager canvas is sage, but lazy-loaded page themes still paint cream/brown surfaces on Orders, Restaurant Info, Staff, RBAC, Schedule, Payroll and AI pages.

The Payroll readiness area also becomes extremely tall when a period has many blocking issues. Its two-column grid stretches the short section to match the tall section, while every issue is rendered in one unbounded vertical list.

## Root cause and flow

Manager pages are lazy-loaded by `ManagerLayout`. Their page CSS chunks load after the shell and use route-specific selectors, variables and hard-coded cream values, so broad global card selectors do not consistently win.

Payroll data flow remains correct:

`payrollReadiness GraphQL schema -> authenticated resolver/restaurant guard -> payrollReadiness service -> usePayroll query -> PayrollManagement -> PayrollReadinessPanel`.

The service intentionally returns all issues. The excessive page length is a presentation defect, not a backend/query defect.

## Implementation

- Add route-specific selectors to the existing manager compatibility layer for the pages visible in the screenshots.
- Rebind page-local variables and neutral surfaces to the shared light-sage palette.
- Keep semantic danger, warning and success indicators unchanged.
- Make readiness grid items align to their own content height.
- Bound each readiness issue list to a viewport-relative height and scroll inside it.
- Keep every issue available and make the scroll region keyboard focusable with an accessible label.

## Files

- `src/layouts/ManagerSageSurfaceOverrides.css`
- `src/components/Dashboard_Manager/PayrollPage/components/PayrollReadinessPanel.jsx`

## Acceptance criteria

- Orders, Restaurant Info, Staff, RBAC, Schedule, Payroll, AI Handoff, AI Analytics and AI Settings use visibly sage neutral surfaces instead of cream/brown primary surfaces.
- Status colors retain their meaning.
- A readiness section with many issues no longer makes the entire payroll page several screens longer.
- The shorter readiness column no longer stretches to the height of the longer column.
- All readiness issues remain readable inside a bounded scroll region.
- Keyboard users can focus and scroll the issue region.
- No schema, resolver, service, Apollo query, payroll calculation or permission behavior changes.

## Validation

- Existing Payroll readiness component tests.
- Frontend build and CI conflict checks.
- Manual visual verification of the screenshot routes when a browser runtime is available.
