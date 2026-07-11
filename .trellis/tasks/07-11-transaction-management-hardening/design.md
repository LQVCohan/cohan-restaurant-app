# Transaction management hardening design

## Minimal root-cause changes

1. Restore the intended Cashflow schema by deleting duplicate keys; add one partial unique refund reference index to prevent duplicate refund outflows.
2. Keep GraphQL contracts truthful: preserve MoMo/VNPay method values and return null for missing order links instead of fabricating IDs.
3. Normalize refund source IDs once in the refund mutation. When an invoice is supplied, resolve its scoped `refTransactionId` and store that payment transaction on the refund.
4. Make supplier payable amounts auditable: creation starts unpaid, edits cannot alter `paidAmount`, payments go through `recordSupplierPayment`, and paid/partial rows cannot be voided.
5. Require a real reconciliation target in both UI and resolver. Hide actions on terminal rows and guard the server against ignoring final matches.
6. Reuse the existing finance dashboard debt output for receivables instead of adding a new query/resolver.
7. Convert local date inputs to ISO with the browser's local timezone rather than appending `Z` to local calendar text.
8. Remove the unsafe duplicate header refund shortcut; refunds start only from a selected eligible journal row.

## Files to change and why

- `cohan-restaurant-backend/models/cashflow.model.js`: restore validation/index contract and refund idempotency index.
- `cohan-restaurant-backend/graphql/schema/payments.graphql`: payment method and nullable order-link contract.
- `cohan-restaurant-backend/graphql/resolvers/payment/types.js`: truthful ID/method serialization.
- `cohan-restaurant-backend/graphql/resolvers/payment/mutation.js`: shared refund, supplier-payable and reconciliation guards.
- `src/hooks/useTransactions.js`: local date conversion and existing finance debt query.
- `src/components/Dashboard_Manager/Transactions/TransactionManagement.jsx`: safe action eligibility and receivable rendering.
- Existing focused frontend/backend tests: regression coverage only; no new framework or fixtures.

## Validation plan

- `npm run check:graphql`
- targeted frontend Vitest for `useTransactions` and `TransactionManagement`
- targeted backend Vitest for refund, supplier payable and reconciliation flows
- `npm run build` only if available after targeted checks
