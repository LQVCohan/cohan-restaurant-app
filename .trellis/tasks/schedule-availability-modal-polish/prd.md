# Schedule availability modal polish

## Current behavior

The manager opens the registered-availability view from the weekly schedule toolbar. The modal receives the current restaurant, current week, staff, availability windows, and submissions from `ScheduleManagement`.

Two UI defects make the view look incomplete:

1. `AvailabilitySnapshotModal` renders the matrix only when a matching availability window exists. Full-time `workingDays` and staff rows are still available without a window, but the component hides the entire table and leaves only a small empty message.
2. The modal shell uses a 50% dark overlay, `overflow: hidden`, and a `90vh` maximum height. This creates a black-screen impression and can clip longer content.

The schedule page also has important actions rendered with nearly identical neutral styling because earlier high-specificity CSS overrides the final sage layer.

## End-to-end flow

`AvailabilityRegistrationWindow` / `StaffAvailabilitySubmission` Mongoose models -> `availability.graphql` -> availability query resolvers and restaurant access guard -> `GET_AVAILABILITY_WINDOWS` / `GET_AVAILABILITY_SUBMISSIONS` in `ScheduleManagement` -> `AvailabilitySnapshotModal` -> manager clicks “Lịch rảnh”.

The backend contract is correct and already enforces authentication, role access, restaurant scope, and window/submission consistency. No backend change is required.

## Root cause

- The modal uses `hasWindow` as both a data-status flag and a rendering gate.
- The modal container clips its own content instead of allowing the shell to scroll.
- The overlay opacity is too heavy for the dashboard’s light visual system.
- Important schedule actions lose emphasis because selectors with higher specificity force neutral button colors.

## Implementation

- Keep `hasWindow` as an informational state, but render the matrix whenever staff rows exist.
- When no matching window exists, show a concise note explaining that the matrix is based on `workingDays` and missing-registration states.
- Add a clear filtered-empty table row instead of showing a blank table body.
- Change modal copy from mixed English/Vietnamese to user-facing Vietnamese.
- Make the overlay lighter and allow the modal shell to scroll within `100dvh` without clipping.
- Preserve the existing internal table scroll for wide weekly matrices.
- Add restrained sage emphasis to the existing primary, statistics, registered-availability, and auto-schedule buttons using current CSS variables and classes.
- Do not add dependencies or alter GraphQL operations.

## Acceptance criteria

- Opening “Lịch rảnh” no longer produces a mostly black screen.
- The complete modal remains visible and scrollable on desktop and mobile-height viewports.
- Staff rows and the weekly matrix are visible even when the week has no matching availability window.
- The no-window note clearly states that no finalized registration period exists.
- Existing official submission and full-time `workingDays` logic remains unchanged.
- Search and filters show an explicit empty row when no employee matches.
- Tạo ca and Chia ca tự động are clearly primary actions; Thống kê and Lịch rảnh have visible but softer emphasis; Cài đặt and In lịch remain neutral.
- Existing restaurant scope, roles, validation, and backend behavior remain unchanged.
- Targeted component tests, frontend lint, build, and smoke tests pass.

## Files

- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.jsx`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.scss`
- `src/components/Dashboard_Manager/Schedule/components/AvailabilitySnapshotModal.test.jsx`
- `src/styles/schedule-manager-sage-upgrade.css`

## Out of scope

- Creating an availability window automatically.
- Changing submission approval rules or status enums.
- Reworking the schedule page layout.
- Adding a new modal library or design system.
- Changing print behavior.

## Validation plan

- Run the focused `AvailabilitySnapshotModal` Vitest file.
- Run frontend conflict checks, lint, changed component tests, production build, and Playwright smoke tests through PR CI.
- Manually inspect the modal at the provided desktop viewport and at 390x844 / 430x932.
