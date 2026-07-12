# Design

## Persistence

`CashierShiftReconciliation` stores restaurant/cashier/optional shift and timesheet scope, opening and counted cash, source transaction/refund IDs, drawer movements, calculated totals, variance, manager adjustment, attribution decision, immutable terminal timestamps and an audit trail. `activeKey` is unique while a record is OPEN or SUBMITTED and is cleared only by a terminal review decision.

## Calculation

```text
cashSalesAmount       = successful cash PaymentTransaction amounts created by the cashier in [openedAt, closedAt]
cashRefundAmount      = successful cash PaymentRefund amounts processed by the cashier in the same range
movementNetAmount     = CASH_IN - CASH_OUT
expectedCash          = openingCash + cashSalesAmount - cashRefundAmount + movementNetAmount + managerAdjustmentAmount
varianceAmount        = actualCash - expectedCash
varianceRate          = abs(varianceAmount) / expectedCash, or 0 when expectedCash <= 0
```

Source IDs are stored on every refresh/submit/review so the result is explainable. Provider and bank callback records are not used as cashier cash-drawer evidence.

## State machine

```text
OPEN -> SUBMITTED -> APPROVED | WAIVED | REJECTED
```

- OPEN: cashier or manager may add movements and refresh.
- SUBMITTED: counted cash is fixed; manager may refresh and decide. A manager adjustment is explicit and audited.
- APPROVED: terminal, optionally attributable to cashier; only attributable approved variance affects performance.
- WAIVED: terminal and never affects performance.
- REJECTED: terminal; a new reconciliation must be opened after correction, preserving the rejected record.

## Performance enrichment

The existing staff recalculation resolver remains authoritative for attendance, kitchen, customer rating, manager review, incidents and appeals. A wrapper runs immediately after it:

1. identifies cashier snapshots;
2. loads successful handled payment transactions, attributable refunds, linked invoice discount evidence and approved cash reconciliations;
3. calculates corrected cashier metrics and the existing operational penalty formula;
4. recomputes Quality from the stored base skill score and customer penalty;
5. recomputes base formula, final score and performance level while preserving incident/appeal deltas;
6. persists updated snapshot fields/factors.

## Client

A separate Apollo hook and modal keep reconciliation state out of the large performance page. `StaffPerformanceOperationsPage` composes the existing policy page and adds one manager launcher. The modal contains a list/detail layout and reuses native buttons, inputs and dialogs without new dependencies.

## Files to change

- New model/service/schema/resolver/hook/modal/test files own the feature.
- `models/index.js`, GraphQL schema/resolver indexes and the Performance barrel only register the new module.
- The existing 1,200-line staff performance service and existing policy modal are not rewritten.
