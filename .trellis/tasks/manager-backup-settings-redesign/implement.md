# Implementation plan

1. Create a feature branch from the latest `main` after planning artifacts are recorded.
2. Fetch the latest target files and inspect callers/tests before each write.
3. Update Settings wording and fallback values, then adjust SCSS without changing the GraphQL contract.
4. Update Backup markup for action hierarchy and native progressive disclosure, then adjust SCSS.
5. Update focused tests only where accessible names change.
6. Run conflict check, the two component tests and build; review the diff for permission or contract drift.
