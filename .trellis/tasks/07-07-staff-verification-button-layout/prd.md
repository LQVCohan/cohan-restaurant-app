# Staff verification button layout

## Current behavior

The resend verification button shares a narrow flex row with the channel selector. The selector can consume the available width while the button has no local minimum width, no no-wrap rule, and no explicit alignment, so its icon and text wrap into an unbalanced two-line layout.

## Flow

`StaffManagement.jsx` provides `onResendVerification` -> `EmployeeDashboard.jsx` forwards it -> `EmployeeDetail.jsx` renders the selector and button -> `EmployeeDetail.scss` controls the row layout.

## File changing

- `src/components/Dashboard_Manager/Staff/components/EmployeeDetail/EmployeeDetail.scss`: balance only the verification action row.

## Acceptance criteria

- The icon and “Gửi lại xác minh” stay on one line.
- The button content is centered vertically and horizontally.
- The button and selector have matching control height.
- The button does not shrink below its readable width.
- Resend behavior and disabled state remain unchanged.

## Validation

- Run the narrowest available frontend build or SCSS compilation check.
- Inspect the selected employee detail panel at the current manager width.

## Out of scope

- Changing verification channels, resend behavior, GraphQL, permissions, or staff data.
