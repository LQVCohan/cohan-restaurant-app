# Overtime request role workflow

## Current behavior

The backend already supports an overtime request workflow, but the UI is incomplete:

- staff can submit their own overtime request from `/staff/attendance`;
- Admin/Manager/HR can review requests on the manager attendance page;
- Admin/Manager/HR can create requests for an employee at the service layer, but the manager UI has no create action;
- the employee confirmation mutation exists, but the staff UI has no confirmation action.

There is also a role-normalization bug in the service. Operational staff accounts commonly expose a specific `roleName` such as `cashier`, `server`, or `kitchen_helper` while retaining `userType: STAFF`. The service currently compares only the first resolved role string to `staff`, which can deny valid self-service creation and fail to force list/detail queries to the current employee.

## Goal

Complete the existing workflow without changing the schema:

1. Admin, Manager, and HR may create an overtime request for an employee in their restaurant scope.
2. Manager-created requests always require the target employee to confirm first.
3. The target employee can confirm the request from `/staff/attendance`.
4. Operational staff roles can create and view only their own requests.
5. Accountant remains read-only and never sees create/review/complete actions.

## Flow traced

`OvertimeRequest schema -> overtimeRequest.service role/scope guards and notifications -> staff mutation resolver -> existing GraphQL mutations/useOvertimeManagement -> manager OvertimePanel and StaffAttendancePage -> service/component tests`.

## Role matrix

| Role | Read restaurant requests | Create for employee | Self-create | Confirm employee request | Approve/reject/complete |
|---|---:|---:|---:|---:|---:|
| Admin | Yes | Yes | N/A | No | Yes |
| Manager | Yes | Yes | N/A | No | Yes |
| HR | Yes | Yes | N/A | No | Yes |
| Accountant | Yes | No | No | No | No |
| Staff operational roles | Own only | No | Own only | Own only | No |
| Customer/other roles | No | No | No | No | No |

## Implementation constraints

- Reuse the existing GraphQL mutations and `useOvertimeManagement` hook.
- Do not add schema fields or dependencies.
- Keep restaurant-scope checks on every read/write.
- Manager-created requests must set `employeeConfirmationRequired: true`.
- Notify the target employee for confirmation; notify reviewers only after a self-submitted request or after confirmation.
- Do not let frontend visibility replace backend authorization.
- Use the existing attendance records for selecting an employee/shift on the chosen day.

## Acceptance criteria

- Admin/Manager/HR see a “Tạo yêu cầu tăng ca” action on the manager overtime panel.
- Accountant can view the panel but sees no create/review/complete controls.
- Creating from manager UI sends the selected employee, restaurant, shift/timesheet, planned times, type, reason, and `employeeConfirmationRequired: true`.
- The new request is `pending_employee_confirmation`.
- The target employee sees a “Xác nhận tăng ca” action on `/staff/attendance`.
- Another employee, reviewer, accountant, or customer cannot confirm it.
- `server`, `cashier`, `kitchen_helper`, and other operational staff role names are treated as staff self-service because their `userType` is `STAFF`.
- Staff request queries are always forced to the authenticated employee.
- Targeted backend and frontend tests pass.

## Validation

```bash
npm run test --prefix cohan-restaurant-backend -- tests/services/overtime-request-workflow.test.js
npm run test -- src/components/Dashboard_Manager/Staff/components/Attendance/OvertimePanel.test.jsx src/components/Staff/StaffAttendancePage.test.jsx
npm run build
npm run build --prefix cohan-restaurant-backend
```

## Out of scope

- New overtime policy configuration
- Payroll calculation changes
- Redesigning the attendance page
- Creating overtime requests without an employee/shift shown for the selected day
