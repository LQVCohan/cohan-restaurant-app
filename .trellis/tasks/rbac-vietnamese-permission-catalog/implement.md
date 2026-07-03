# Implementation plan

1. Fetch latest label utility, app entrypoint, permission seed and RBAC tests from the feature branch.
2. Replace the unused/incomplete DOM label patch with a smaller formatter API plus scoped installer.
3. Add the single installer call to `main.jsx`.
4. Normalize all human-facing names/descriptions in `seedPermissions.js` without changing permission codes.
5. Add utility tests proving Vietnamese labels and preserving permission count/code.
6. Run targeted frontend tests, conflict check, GraphQL validation and build; review diff for permission-code or authorization drift.
