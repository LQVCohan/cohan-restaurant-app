# Polish manager attendance workspace UI

## Current behavior

The manager attendance page shows several controls that look visually broken in the empty-data state:

- The employee search control renders as a bordered wrapper containing another bordered input.
- The reconciliation surface inherits generic global card styles and looks nested.
- The empty reconciliation badge renders `-- •` before its message.
- The direct attendance action keeps a fixed 360px description next to a three-column form, so fields become cramped inside the real manager content width.
- The empty attendance table keeps unnecessary minimum height.

## Root cause and flow

Data flow remains valid:

`Timesheet schema -> staffAttendanceRecords resolver/restaurant guards -> QUERY_ATTENDANCE_PAGE/useAttendanceManagement -> AttendancePage -> attendance component tests and manager-attendance Playwright test`.

The defects are at the UI boundary. Attendance component styles, global HR polish files, and generic classes such as `search-box` and `card` share the global cascade. Later fixed-width attendance overrides also do not fit the nested manager content width.

## Implementation

Use one attendance-specific final CSS layer loaded after existing global styles. This is smaller and safer than rewriting the large attendance component or duplicating layout rules in multiple existing stylesheets.

The layer will:

- reset the attendance toolbar search wrapper so only the native input has a border;
- stack the direct-action explanation above the form and preserve responsive form columns;
- neutralize generic card side effects on the reconciliation panel;
- visually remove the null-score `-- •` prefix while retaining the existing accessible headline;
- remove the forced minimum height in empty attendance tables;
- preserve native controls, focus indicators, queries, mutations, permissions, and restaurant scoping.

## Files

- `src/main.jsx`
- `src/styles/AttendanceManagerVisualFix.css`

## Acceptance criteria

- The attendance search field has one border and fills its intended toolbar column.
- The quick attendance form is not compressed by the explanatory copy.
- The reconciliation panel has one intentional surface and no generic card collision.
- Empty reconciliation status does not visually show `-- •`.
- Empty attendance tables do not leave a forced 400px blank panel.
- Existing attendance behavior remains unchanged.

## Validation

- Existing Playwright path: `tests/e2e/p1/manager-attendance.spec.js`
- Frontend lint/build and CI checks
- Manual visual review at desktop and narrow breakpoints when a browser runtime is available

## Out of scope

- Attendance data model, schema, resolver, or hook changes.
- Redesigning the whole Staff Management page.
- Changing attendance wording, permissions, mutations, corrections, or overtime workflows.
- Adding dependencies or a new design system.
