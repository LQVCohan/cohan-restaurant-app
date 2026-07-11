# Transaction management hardening

## Current behavior and confirmed root causes

- `CashflowSchema` declares `category` and `subcategory` twice; the later plain-string definitions override the enum/index definitions.
- Refunds launched from payment cashflows reference an invoice, while the refund resolver searches `PaymentTransaction.invoiceId`, a field that older/current payment creation does not reliably populate.
- The page can offer refunds for manual inflows and the header shortcut silently chooses the first inflow instead of a user-selected payment.
- Supplier payable create/update accepts direct `paidAmount` changes without creating a matching cashflow; partially paid payables can also be voided while their outflows remain.
- Manual reconciliation can be submitted without a selected payment when a note is present; force matching without a target remains unmatched.
- Final bank/reconciliation rows still expose actions that can overwrite completed decisions.
- Transaction date boundaries are constructed as UTC midnight instead of local-calendar boundaries.
- The receivable panel derives invoices from cashflow rows, so unpaid/partial invoices never appear.
- GraphQL payment methods omit `momo` and `vnpay`, and the resolver falls back to `cash` for both.
- `PaymentTransaction.orderId` and `Invoice.orderId` use their own document ID as a fake fallback when no order exists.

## End-to-end flow

`Cashflow/PaymentTransaction/Invoice/PaymentRefund/SupplierPayable/PaymentReconciliation models -> payments.graphql -> payment query/mutation/type resolvers and permission/audit services -> useTransactions Apollo operations -> TransactionManagement actions/modals -> targeted frontend/backend tests`.

## Acceptance criteria

- Cashflow category/subcategory validation and indexes remain active.
- MoMo/VNPay retain their actual method through GraphQL.
- Refund creation accepts invoice-backed journal rows, resolves the actual payment transaction when available, and rejects non-payment inflows before submission.
- Supplier paid amounts change only through the payment mutation that creates a cashflow; payables with recorded payments cannot be voided.
- Manual reconciliation always has a selected payment target; terminal bank/reconciliation states cannot be accidentally overwritten from the UI.
- Date filters represent the user's local start/end of day.
- Open receivables are sourced from finance invoice debt data, not cashflow statuses.
- Order links return null rather than a fabricated document ID.
- Targeted regression tests cover each corrected boundary.

## Out of scope

- Rebuilding payment provider integrations.
- Adding dependencies or a new finance abstraction.
- Changing stored currency away from VND.
- Designing a reversal workflow for already-paid supplier payables; this task blocks unsafe voiding instead.
