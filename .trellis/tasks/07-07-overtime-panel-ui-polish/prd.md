# Manager overtime interface polish

## Current behavior and root cause

`AttendancePage.jsx` renders `OvertimePanel.jsx`, which already exposes the correct manager workflow through `useAttendanceManagement` and `useOvertimeManagement`. The interface itself remains visually weak because the repository's dedicated `OvertimePanelPolicyPolish.scss` is not loaded by the application. The create form therefore falls back to generic styles, section hierarchy is unclear, and the shared `.table-section` minimum height leaves a large blank area during empty or connection-error states.

The browser screenshot also shows `ERR_CONNECTION_REFUSED` for `localhost:4000/graphql`. That is a backend availability/configuration issue, not a frontend layout defect. This task keeps the error visible but presents it in a compact, readable state.

## Flow traced

`OvertimeRequest model and service guards -> GraphQL overtime requests/mutations -> useOvertimeManagement and useAttendanceManagement -> AttendancePage -> OvertimePanel -> Attendance.scss and OvertimePanelPolicyPolish.scss`.

No schema, resolver, hook contract, enum, mutation payload, role check, restaurant scope, audit, or realtime behavior changes.

## Files changing

- `src/components/Dashboard_Manager/Staff/components/Attendance/OvertimePanelPolicyPolish.scss`: complete the existing scoped visual layer for summary metrics, manager request form, section headings, tables, buttons, empty/error states, focus states, and responsive layouts.
- `src/main.jsx`: load the existing polish stylesheet after the broader attendance visual overrides so the intended final styles take effect.

## Visual direction

Use the existing COHAN manager palette: warm ivory surfaces, sage green actions, restrained amber/blue status accents, compact operational typography, and tabular data figures. Prioritize scanning and decision-making over decoration.

## Acceptance criteria

- Four summary metrics have clear hierarchy and remain balanced at desktop, tablet, and mobile widths.
- The create-request form reads as one intentional workflow with aligned labels, controls, guidance, and submit action.
- Section titles and filters are visually distinct without adding new components.
- Empty, loading, and error states no longer create an oversized blank panel.
- Tables remain horizontally scrollable when needed and retain accessible focus/hover states.
- Existing overtime behavior, permissions, requests, and mutations remain unchanged.

## Validation

- `npm run build`
- Inspect desktop layout at the supplied manager width.
- Inspect responsive layouts at 1180px, 720px, 430x932, and 390x844.

## Out of scope

- Starting or reconfiguring the GraphQL backend.
- Changing overtime business rules, statuses, calculations, or permissions.
- Adding dependencies or redesigning the whole attendance page.
