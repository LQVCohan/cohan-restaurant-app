# Cohan wallet and MoMo parity implementation

## Completed trace

`User.wallet / WalletTransaction / PaymentSession / PaymentTransaction / Invoice / Cashflow / PaymentRefund / Order / CheckoutSession -> wallet service and shared paid-order settlement -> wallet/order GraphQL resolvers -> customer checkout and manager wallet UI -> focused regression tests`.

## Findings before the fix

- MoMo/VNPAY wallet top-up already used signed provider PaymentSession callbacks, amount verification and idempotent crediting.
- Selecting Cohan wallet at checkout did not debit the wallet; the checkout UI could show success after only creating orders.
- Wallet orders did not pass through the deferred online-payment boundary and could leave draft/payment-pending flow before a successful debit.
- The standalone wallet payment path created a payment transaction and cashflow but skipped the shared invoice, kitchen release, table-session and promotion settlement used by provider payments.
- Manager wallet refunds could be submitted without an order source, and manual balance adjustments were not scoped to a restaurant.

## Implemented

1. Added `cohan_wallet` as an internal PaymentSession provider while keeping credential lookup and callback priming limited to external MoMo/VNPAY providers.
2. Replaced the duplicated wallet order ledger with an internal successful PaymentSession and the existing `settlePaidOrderPaymentSession` boundary.
3. Wallet debit, PaymentSession, PaymentTransaction, Invoice, Cashflow, WalletTransaction, order release and audit event now commit in one MongoDB transaction or roll back together.
4. Preserved idempotency through a stable wallet reference, existing transaction recovery and duplicate-key recovery.
5. Corrected multi-order payment state so each order stores its own total rather than the aggregate paid amount.
6. Routed `paymentMethod: wallet` through deferred checkout; checkout succeeds only after the wallet debit and shared settlement succeed.
7. Emitted the existing `PAYMENT_VERIFIED` realtime event for checkout and direct wallet payments.
8. Required one restaurant for a wallet checkout and one concrete order for a wallet refund.
9. Changed wallet refund permission to `refund.write`; refund now verifies customer, restaurant, order, successful transaction and refundable balance.
10. Wallet refund now updates PaymentRefund, WalletTransaction, Cashflow, PaymentTransaction, Invoice and order partial/full refund status in one transaction.
11. Required `restaurantId` for balance adjustment, verified the customer has an order in that restaurant, and added an auditable wallet adjustment event.
12. Updated the manager wallet UI to disable money-changing actions in all-restaurant scope and require one source order for refund.
13. Added focused tests for deferred wallet checkout, internal PaymentSession support, shared settlement usage, idempotency, source-bound refunds and restaurant-scoped adjustments.

## Intentional differences from MoMo

- Cohan wallet does not redirect to an external payment page and does not wait for a signed external callback; sufficient internal balance is settled immediately.
- MoMo/VNPAY credentials and signatures remain external-provider-only.
- After the confirmation point, both flows use the same authoritative restaurant ledger and order-release invariants.

## Validation status

- Every changed target file and its callers were re-fetched from latest `main` after the writes; the changes remained present.
- Caller search found the changed manager refund/adjustment GraphQL inputs only in the updated manager wallet screen.
- No dependency or new architectural abstraction was added.
- The local runtime still could not resolve `github.com`, so the repository could not be cloned to run Vitest, GraphQL validation or Vite build.
- The final direct commit had no GitHub Actions workflow run or combined status checks.
- Therefore the implementation and focused regression tests are committed, but runtime/CI verification is not confirmed.
