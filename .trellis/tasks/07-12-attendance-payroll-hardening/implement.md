# Implementation plan

1. Guard manager quick attendance against self-service use.
2. Align `StaffAttendanceRecord` with the active staff schedule operation.
3. Rework payroll runtime aggregation from timestamp intervals and approval state.
4. Exclude rejected overtime from validation/readiness blockers.
5. Add focused access and payroll regression tests.
6. Run targeted tests, GraphQL validation, and build checks when runtime access is available.
