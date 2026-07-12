# Cashier reconciliation UI implementation

## Completed

- Reorganized selected-shift detail around the manager decision: expected cash, counted cash, and variance now form the primary comparison.
- Replaced the equal metric-card grid with a compact money-flow breakdown for opening cash, sales, refunds, drawer movements, and manager adjustment.
- Changed status filtering to client-side filtering of the already-loaded reconciliation list so every status can show an accurate visible count without another request.
- Added selected/pressed state semantics, scoped action-button styles, live success/loading feedback, composed loading and empty states, and localized `Intl` formatting.
- Added form names, autocomplete/input-mode metadata, 44px targets, visible focus, safe-area padding, `100dvh`, contained overscroll, reduced-motion handling, and a horizontal mobile shift rail.
- Aligned the performance-page launcher with the existing manager token system and kept the no-automatic-penalty guard visible at responsive widths.
- Added focused component coverage for the financial hierarchy, filter counts, selected-shift state, open-shift action, and manager responsibility review.

## Validation

GitHub Actions CI run `9008` passed on code head `c30ffc8c874c43ee65c956302a2eded2797fd5cb`:

- backend lint, tests, Menu RBAC, and build: passed;
- frontend unresolved-conflict check and lint: passed;
- frontend unit tests and changed component tests: passed;
- frontend Menu RBAC and build: passed;
- Playwright browser setup and smoke tests: passed.

The optional full component suite was skipped by the workflow after the changed-component suite passed. Manual screenshot comparison at 390/430/768/1440 widths was not available in the connector-only environment.
