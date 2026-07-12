# Cashier reconciliation UI polish

## Current behavior

The manager modal exposes the complete cashier reconciliation lifecycle, but the interface gives equal visual weight to every amount, relies on a generic metric-card grid, uses many hardcoded colors, and becomes vertically dense on phone widths. The status filter has no result counts, loading is plain text, and generic button classes can inherit unrelated styles.

## Root cause

The modal was implemented around backend fields rather than the manager's primary decision: compare expected cash, counted cash, and variance, then act. Styling is local but does not consistently reuse manager tokens or the shared accessibility/touch rules.

## End-to-end flow

`CashierShiftReconciliation GraphQL data -> useCashierShiftReconciliation hook -> StaffPerformanceOperationsPage launcher -> CashierShiftReconciliationModal filter/forms/detail -> manager open/movement/submit/review actions -> component tests`.

## Visual direction

Compact operational cash-control workspace using sage surfaces, a financial equation hierarchy, one high-contrast primary action, and a horizontally scrollable shift rail on mobile.

## In scope

- Reorganize the modal around expected cash, actual cash, and variance.
- Present source amounts as a compact money-flow breakdown rather than equal cards.
- Add status counts, clearer selected state, loading skeletons, and composed empty states.
- Scope button styles to the feature and reuse manager tokens.
- Improve labels, input metadata, focus, live regions, touch targets, safe areas, and reduced motion.
- Keep existing GraphQL operations, permissions, business rules, and mutation payloads unchanged.

## Out of scope

- No schema, resolver, service, calculation, or authorization changes.
- No new component library, icon package, font, or dependency.
- No new route or standalone cashier page.
- No redesign of the full staff performance table.

## Acceptance criteria

1. The primary financial comparison is immediately visible in selected-shift detail.
2. The opening/sales/refund/movement/adjustment breakdown remains complete and readable.
3. All actions remain available only in their current lifecycle states.
4. Filter buttons communicate selection and item counts without color alone.
5. Interactive controls are keyboard accessible, visibly focused, and at least 44px on touch layouts.
6. The modal uses `100dvh`, safe-area padding, contained overscroll, and has no horizontal page overflow at 390, 430, 768, 1024, and 1440 widths.
7. Loading, empty, error, disabled, and reduced-motion states remain understandable.
8. Existing manager-flow component tests pass and focused UI assertions cover the new hierarchy.

## Validation plan

- Targeted Vitest component test for `CashierShiftReconciliationModal.test.jsx`.
- Frontend lint/conflict check for changed files.
- Frontend build.
- GitHub Actions smoke test when available.
- Manual screenshot comparison is reported as not run when no browser screenshot environment is available.
