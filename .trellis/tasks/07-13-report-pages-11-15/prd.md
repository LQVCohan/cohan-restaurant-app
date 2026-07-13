# Report pages 11–15

## Outcomes

- Valid leave dates reach GraphQL as `DateTime` values and all leave feedback uses concise Vietnamese toast/inline copy without GraphQL variables, scalar names, internal IDs or stack details.
- Weekly schedule cards describe shift duration separately from the actual full-time/part-time composition of assigned staff.
- Staff settings gives authorized management accounts an explicit way back to the manager workspace and everyone a Home action.
- Dashboard operational cards use stable React composition instead of a mutation-observed portal that can overlap sibling grid content.
- Every numeric payroll setting shows its currently saved value next to the editable control.
- The collapsed manager rail is independently scrollable and expanding it reveals the active destination.
- Customer recent-order rows open the exact order through the existing manager order detail flow; “Xem tất cả” opens the order workspace with customer context.
- The add-customer primary action has a valid non-hover background and visible text in every state.

## Root causes

1. Date serialization was already fixed, but the leave form still bypasses the shared toast and renders raw load errors.
2. Schedule contract labels are inferred from four/eight-hour duration instead of `staffList.employmentType`.
3. Staff settings lacks local recovery actions even though the staff shell has global portal links.
4. Dashboard staff roster is inserted using `MutationObserver` + `createPortal` into a grid whose wrappers become `display: contents`, making layout timing fragile.
5. Payroll inputs load the saved values into the form but do not retain a visible saved-value reference after editing.
6. The sidebar flex scroller has no `min-height: 0`; the earlier overflow override is insufficient when content exceeds the viewport.
7. Customer rows call an optional callback that `CustomerManagement` never passes, and `OrderManagement` does not consume an order deep-link.
8. Add-customer footer uses `var(--acm-primary-dark)` outside the element that defines it, invalidating the normal-state background declaration; hover works because it uses a literal color.

## Constraints

- Preserve restaurant scoping and existing backend order access guards.
- Reuse manager navigation events, order query/detail modal, notification provider and design tokens.
- No dependency or schema change.
- Keep browser history meaningful and avoid raw IDs in user-facing copy.

## Acceptance

- Direct unit/component coverage exists for every behavior above.
- Frontend focused tests, GraphQL contract checks and production build pass.
- Backend order resolver contract is unchanged and remains permission scoped.
