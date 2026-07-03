# Fix overlapping leave request modal

## Current behavior

The create-leave dialog is mounted inside `LeaveManagement` and `StaffLeavePage` as a custom `position: fixed` overlay. Both pages can live under layout ancestors that use `transform`, `contain: paint`, internal scrolling and isolated stacking contexts. The dialog can therefore be clipped, visually overlap the wrong layer, or fail to cover the full viewport.

## Root cause and flow

The leave data flow is valid and remains unchanged:

`CreateLeaveRequestInput -> staff createLeaveRequest resolver/access checks -> M_CREATE/useLeaveManagement -> LeaveRequestForm -> create button in manager/staff leave page`.

The defect is at the UI boundary. The repository already has a shared `Modal` component that renders through `createPortal(document.body)`, locks page scroll, traps focus, closes on Escape and restores focus. The leave pages bypass that component and reimplement an in-tree overlay.

## Requirements

- Reuse the shared portal `Modal` component in both manager and staff leave pages.
- Preserve the current form, fields, mutation payload, validation, success/error behavior and close-after-submit behavior.
- Keep a single scrollable modal body and avoid nested viewport overlays.
- Remove unused custom overlay/dialog/close-button CSS.
- Preserve responsive behavior and the existing sage visual direction.
- Add a focused component test proving the manager leave dialog is portaled to `document.body` and closes on Escape.

## Acceptance criteria

- The leave request modal covers the viewport and is not clipped by the manager content or sidebar.
- The same fix applies to the staff self-service leave page.
- Opening the modal locks page scroll and moves focus into the dialog through the shared component.
- Escape and the shared close button close the modal.
- The existing leave form still submits through `useLeaveManagement` without GraphQL changes.
- A component test verifies the portal boundary and Escape close path.

## Files

- `src/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveManagement.jsx`
- `src/components/Staff/StaffLeavePage.jsx`
- `src/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveModal.scss`
- `src/components/Dashboard_Manager/Staff/components/LeaveManagement/LeaveManagement.test.jsx`

## Validation

- Targeted Vitest for `LeaveManagement.test.jsx` and `LeaveRequestForm.test.jsx`.
- Frontend build and conflict check in CI.
- Manual modal review at desktop and mobile widths when a browser runtime is available.

## Out of scope

- Leave schema, resolver, authorization, quota, payroll flags or approval behavior.
- Rewriting `LeaveRequestForm` or replacing alerts in this task.
- Changing the leave-management page layout outside the modal.
