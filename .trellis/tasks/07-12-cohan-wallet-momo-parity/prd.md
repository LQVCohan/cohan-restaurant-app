# Cohan wallet and MoMo payment parity

## Current behavior and root cause

- Wallet top-up through MoMo/VNPAY already uses the provider PaymentSession callback, amount verification and idempotent credit flow.
- Customer checkout renders a Cohan wallet option, but after orders are created it never calls `payOrdersWithWallet`; the UI shows success while the wallet is unchanged.
- Wallet checkout is not routed through deferred online checkout, so orders can leave the draft/payment-pending boundary before the wallet debit succeeds.
- `payOrdersWithWallet` duplicates a smaller settlement path. It creates a payment transaction and cashflow, but does not create the invoice or reuse the shared order release, coupon/promotion, table-session and settlement metadata behavior used by MoMo.
- The duplicated wallet path writes the aggregate payment amount onto every order in a multi-order payment.

## End-to-end flow

User wallet and WalletTransaction models -> wallet GraphQL mutation -> wallet service -> internal PaymentSession -> shared paid-order settlement -> PaymentTransaction/Invoice/Cashflow -> order release and realtime -> checkout Apollo mutation and success UI -> targeted tests.

## Scope

- Keep MoMo/VNPAY top-up behavior unchanged.
- Make Cohan wallet order payment immediate but settle through the same authoritative paid-order boundary as MoMo.
- Keep wallet debit, WalletTransaction, invoice, cashflow and order state changes in one MongoDB transaction.
- Defer wallet checkout orders until debit succeeds.
- Wire the existing checkout wallet option to the real mutation and restrict it to one restaurant, matching the current VNPAY checkout constraint.
- Emit the same payment realtime event after internal wallet settlement.

## Constraints

- No new dependency or new payment abstraction.
- Preserve customer ownership, restaurant scoping, permissions, audit logs, inventory/kitchen release and idempotency.
- Do not make the internal wallet call external provider callbacks.
- Do not change cash, transfer, MoMo or VNPAY behavior except for a shared settlement correctness fix.

## Acceptance criteria

1. Selecting Cohan wallet calls `payOrdersWithWallet`; success is shown only after the mutation succeeds.
2. Wallet checkout orders remain draft/payment-pending until the debit succeeds.
3. Successful wallet payment creates one PaymentSession, PaymentTransaction, Invoice, Cashflow and WalletTransaction in one transaction.
4. The shared settlement stores `e_wallet` as the payment method and `cohan_wallet` as the provider.
5. Each paid order records its own order total, not the aggregate amount for every order.
6. Insufficient balance leaves the wallet unchanged and does not release the order to kitchen/restaurant processing.
7. Duplicate wallet submission returns the prior successful payment without double debit or duplicate ledger rows.
8. Restaurant and customer realtime payment updates are emitted after success.
9. Targeted backend and frontend tests cover the wallet branch and deferred checkout behavior.

## Out of scope

- Peer-to-peer wallet transfers or withdrawals.
- External provider refund APIs.
- Multi-restaurant atomic wallet checkout.
- Redesigning the wallet or checkout screens.
