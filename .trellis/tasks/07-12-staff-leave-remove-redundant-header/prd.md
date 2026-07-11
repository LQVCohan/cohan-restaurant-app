# Remove redundant staff leave header

## Current behavior and root cause

The staff leave page renders a large hero, a separate current-user card, a three-card guide, and then a history panel. The hero repeats the create action and the same total/pending/approved counts already rendered by `LeaveRequestsList`. The current-user card repeats information already fixed by self-service scope, while the external guide repeats the wizard progress shown inside the create modal.

## End-to-end flow

`LeaveRequest` -> staff leave GraphQL resolver -> `useLeaveManagement` -> `StaffLeavePage` -> `LeaveRequestsList` and step-by-step `LeaveRequestForm` -> create request mutation.

No schema, resolver, permission, restaurant scope, date calculation, mutation payload or approval history needs to change.

## Direction

Single-panel staff self-service page: show the employee's leave history, filters, summary counts and one create action immediately, with all instructions kept inside the three-step modal.

## Scope

- Remove the decorative hero, duplicated KPI cards, current-user card and external three-step guide.
- Remove component constants and memoized values used only by the deleted sections.
- Keep `LeaveRequestsList` as the page's only visible panel and rename its title to `Đơn nghỉ phép của tôi`.
- Keep the create action in the history-panel header.
- Preserve the existing step-by-step modal and self-service employee scope.
- Update focused component and browser tests.

## Acceptance criteria

1. `/staff/leave` opens directly on one leave-history panel.
2. The page no longer renders the large `Đăng ký nghỉ phép` hero, current-user card, or external guide cards.
3. Total, pending and approved counts remain visible once in `LeaveRequestsList`.
4. One `Tạo đơn` action remains visible and opens the same three-step wizard.
5. Creating a request sends the same GraphQL payload and the created request appears in history.
6. The page remains contained at phone and desktop widths without the removed sections leaving empty space.

## Out of scope

- Changing `LeaveRequestsList` shared manager behavior.
- Changing the wizard fields, validation, request payload, backend, approval flow or permissions.
- Adding a new component, dependency, route or header replacement.

## Validation plan

- `npx vitest run src/components/Staff/StaffLeavePage.test.jsx`
- `npx playwright test tests/e2e/p1/staff-leave.spec.js`
- `npm run build`
- Manual review at 390x844, 430x932, 768px and 1440px when a browser runtime is available.
