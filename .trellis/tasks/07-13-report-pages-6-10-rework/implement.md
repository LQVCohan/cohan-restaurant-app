# Implementation checklist

- [x] Add floor-aware first-available table-code generation and tests.
- [x] Replace the restaurant map DOM injector with a React-owned map and remove the entry-point installer.
- [x] Remove redundant restaurant read-after-write mismatch gating; keep application toasts and baseline state correct.
- [x] Add employee-detail tabs and focused tests.
- [x] Compact correction modal and attendance exception queue; update component tests.
- [x] Simplify the compact leave modal and retain staff wizard behavior; update tests.
- [x] Run targeted tests, lint, GraphQL/conflict checks, build, and final UI/accessibility audit.
- [ ] Commit, publish a draft PR, and monitor CI.

## Validation results

- Targeted component tests: 56 passed.
- Unit suite: 393 passed.
- Production build, lint, GraphQL validation, conflict-marker check, and staff-theme check: passed.
- Full component suite: 997 passed/skipped and 21 failed in unrelated files; the identical 21 failures reproduce on `origin/main`.
