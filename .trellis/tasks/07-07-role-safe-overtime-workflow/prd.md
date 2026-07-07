# Complete role-safe overtime workflow

## Current behavior and root cause

The backend already supports both overtime request directions, but the UI exposes only part of the workflow:

- Staff can create an overtime request for themselves.
- Admin, Manager, and HR can review requests.
- Admin, Manager, and HR can create a request for an employee with employee confirmation required.
- Staff can confirm only a request assigned to themselves.

The manager UI did not expose request creation, and the staff UI did not expose employee confirmation. This was a missing UI connection, not a missing backend permission rule.

## End-to-end flow

`OvertimeRequest model -> overtimeRequest.service role and restaurant-scope guards -> staff GraphQL mutations -> useOvertimeManagement / StaffAttendancePage Apollo operations -> manager and staff UI actions -> component and resolver tests`.

## Permission matrix

| Role | Read | Create | Confirm | Approve / reject / complete | Cancel |
|---|---|---|---|---|---|
| ADMIN | Restaurant scope | For scoped staff | No | Restaurant scope | Restaurant scope |
| MANAGER | Restaurant scope | For scoped staff | No | Restaurant scope | Restaurant scope |
| HR | Restaurant scope | For scoped staff | No | Restaurant scope | Restaurant scope |
| ACCOUNTANT | Restaurant scope | No | No | No | No |
| STAFF | Own requests only | Own request only | Own assigned request only | No | Own request only |

The frontend mirrors this matrix, but backend service and restaurant-scope checks remain authoritative.

## Files changed

- `src/components/Dashboard_Manager/Staff/components/Attendance/OvertimePanel.jsx`: expose manager-created overtime requests only for Admin, Manager, and HR; keep Accountant read-only.
- `src/components/Dashboard_Manager/Staff/components/Attendance/OvertimePanel.test.jsx`: verify the manager role matrix and request payload.
- `src/components/Staff/StaffAttendancePage.jsx`: expose confirmation only for `pending_employee_confirmation` requests visible to the authenticated employee.
- `src/components/Staff/StaffAttendancePage.test.jsx`: verify employee confirmation and preserve self-service create/cancel behavior.

## Acceptance criteria

- Admin, Manager, and HR see the create form and review actions.
- Accountant can read overtime data but sees no create or review action.
- Manager-created requests set `employeeConfirmationRequired: true`.
- A manager-created request starts in `pending_employee_confirmation`.
- Staff sees a Confirm action only on their own `pending_employee_confirmation` request.
- Confirming moves the request to `pending_approval`.
- Staff cannot confirm another employee's request; backend owner check remains active.
- All actions remain restaurant-scoped.
- Existing staff self-create, cancel, manager review, and completion flows remain intact.

## Validation

```bash
npm run test -- src/components/Dashboard_Manager/Staff/components/Attendance/OvertimePanel.test.jsx src/components/Staff/StaffAttendancePage.test.jsx
npm run build
npm run test --prefix cohan-restaurant-backend -- tests/resolvers/staff-overtime-mutation-access.test.js tests/services/overtime-request-workflow.test.js
```

## Out of scope

- Changing backend role constants.
- Allowing Accountant to mutate overtime.
- Allowing Staff to create or confirm requests for another employee.
- Adding new permissions or dependencies.
