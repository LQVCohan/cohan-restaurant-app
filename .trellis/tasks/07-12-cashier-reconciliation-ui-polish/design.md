# Cashier reconciliation UI design

## Audit findings

- The current detail starts with 8 equal metric cards, so expected cash, actual cash, and variance do not dominate the decision.
- Source amounts are visually fragmented even though they form one equation.
- The modal hardcodes most colors instead of using the manager token system.
- Generic `.btn-primary` and `.btn-secondary` class names risk cross-page style drift.
- Phone layout stacks a tall list above a tall detail view; the current-shift decision starts too far below the fold.
- Touch targets are mostly 36–40px, below the project UI skill target.
- Form controls lack useful `name`, `autocomplete`, and numeric `inputMode` metadata.
- Loading and empty states are text-only and do not preserve the final layout shape.

## Smallest safe implementation

1. Keep the existing modal, hook, operation payloads, and component boundaries.
2. Replace only the detail presentation:
   - one comparison strip for expected, actual, and variance;
   - one compact source breakdown for opening cash, sales, refunds, drawer movements, and manager adjustment;
   - existing notes, movement history, and lifecycle forms remain below.
3. Derive status counts from the already-loaded `items`; do not add requests or cache state.
4. Rename feature buttons to locally scoped classes and centralize local CSS variables at the modal root.
5. Use CSS Grid on desktop and a horizontal scroll-snap shift rail on mobile; no JS measurement or new dependency.
6. Preserve the existing focus trap and add semantic pressed/current state, live regions, safe-area and reduced-motion behavior.

## Component changes

### `CashierShiftReconciliationModal.jsx`

- Use memoized `Intl.NumberFormat` and `Intl.DateTimeFormat` helpers.
- Extend status metadata with short labels used consistently in filters and rows.
- Add `MoneyFlowRow`, comparison summary, skeleton and empty-state helpers.
- Add status counts and `aria-pressed` to filters/rows.
- Add field names, autocomplete, input mode, and clearer loading labels.
- Keep all mutation inputs and action visibility unchanged.

### `CashierShiftReconciliationModal.scss`

- Define feature-local variables backed by manager CSS variables.
- Replace equal-card styling with comparison and money-flow layouts.
- Use `100dvh`, safe-area insets, `overscroll-behavior: contain`, 44px controls, scoped focus rings, and explicit transitions.
- At phone widths, render the reconciliation list as a horizontal snap rail and keep the selected detail directly below it.

### `StaffPerformanceOperationsPage.scss`

- Reduce launcher decoration, align it with the performance policy launcher, and preserve one-line desktop behavior.

### Test

- Assert financial comparison labels and status counts.
- Assert selected shift uses pressed state.
- Preserve existing open/review action contract assertions.
