# Cashier shift reconciliation and performance evidence

## Current behavior and root causes

- Staff performance sets `cashVarianceRate` to `0`; there is no cashier cash-drawer reconciliation model.
- Existing `PaymentReconciliation` compares bank transactions with payment sessions and has no cashier, shift, opening cash or counted cash context.
- Cashier performance uses order count as the payment denominator, detects refunds from an order status that the refund flow does not set, and reads discount authorization from order totals although payment-time discount evidence is stored on invoices/payment metadata.
- No manager UI exists to open a cashier shift, record drawer movements, submit counted cash or decide whether a variance is attributable to the cashier.

## End-to-end flow

`CashierShiftReconciliation model -> reconciliation lifecycle/calculation service -> guarded GraphQL query/mutations -> Apollo hook -> manager performance modal -> approved reconciliation enrichment wrapper -> persisted StaffPerformanceSnapshot factors/quality/final score`.

## Scope

- Open one active reconciliation per restaurant, cashier and register.
- Record auditable cash-in/cash-out movements while open.
- Recalculate expected cash from opening cash, successful cash payments, successful attributable cash refunds and drawer movements.
- Submit counted cash and evidence for manager review.
- Allow manager/HR/accountant/admin to approve as attributable, waive responsibility or reject for correction; terminal decisions are locked.
- Use only approved, cashier-attributable variances in performance scoring.
- Replace the cashier payment denominator with successful `PaymentTransaction` records handled by the cashier.
- Read cashier-attributable refunds from `PaymentRefund` and discount evidence from linked invoices.
- Keep provider/bank callback errors out of cashier scoring unless explicit cashier attribution exists.
- Add a manager modal on the staff performance screen for the full lifecycle.

## Acceptance criteria

1. A cashier/register cannot have two active open/submitted reconciliations.
2. Expected cash is reproducible from stored source IDs and movement/audit data.
3. Cashier/self actions are limited to their own reconciliation; review decisions require a manager role and restaurant access.
4. Submitted and terminal records cannot be silently edited; manager adjustment and decision are audited.
5. `cashVarianceRate` is derived only from approved records marked attributable to the cashier.
6. Performance recalculation persists corrected cashier metrics and recomputes Quality, base formula, final score and level.
7. The manager modal exposes opening, movements, submit, refresh and review actions with loading/error/empty states and keyboard-accessible controls.
8. Focused tests protect the state machine, formulas, schema and UI operation contract.

## Out of scope

- Hardware cash drawer integration or denomination counting.
- Automatic bank/provider reconciliation changes.
- Rebuilding POS payment creation.
- Automatically disciplining a cashier without a manager decision.
- Adding a new dependency.

## Validation plan

- Targeted Vitest service tests for calculation, state guards and performance enrichment.
- GraphQL schema/resolver contract tests.
- Component/source contract test for the manager modal operations.
- `npm run check:graphql`, `npm run check:conflicts` and `npm run build` when a runnable checkout is available.
