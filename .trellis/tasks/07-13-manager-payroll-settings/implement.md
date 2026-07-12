# Implementation plan

1. Extend payroll settings permission to MANAGER while preserving restaurant scope.
2. Add shared resolver-side role filtering and input validation before `PayrollSetting.findOneAndUpdate`.
3. Expose current payroll actor details and refetch settings after mutation.
4. Add an inline settings drawer to `PayrollManagement` with operational and restricted groups.
5. Add responsive/focus/loading/error styles in the existing payroll stylesheet.
6. Extend targeted mutation-access tests for manager allowed/restricted fields and invalid values.
7. Run the narrowest available GraphQL, test and build checks.
