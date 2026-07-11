# Design

## Reuse the paid-order settlement boundary

`settlePaidOrderPaymentSession` remains the only function that creates the restaurant-side payment transaction, invoice, cashflow, order release, coupon/promotion accounting and table-session closure.

The wallet service creates an internal successful `PaymentSession` with:

- `provider: cohan_wallet`
- `paymentMethod: e_wallet`
- stable idempotency reference
- the same `metadata.orderIds` and `metadata.source: order_payment` shape used by provider sessions

Within one Mongo transaction it deducts the wallet, calls shared settlement, writes `WalletTransaction`, and records the audit event.

## Shared settlement corrections

The shared settlement uses `paymentMethod` for ledger/payment method and `provider` for provider identity. It records `userId` on `PaymentTransaction` and stores each order's own grand total as `payment.paidAmount`.

## Checkout boundary

`withDeferredOnlineCheckout` treats `wallet` like `card`: order creation reuses the existing deferred transfer transaction, then restores method `wallet` and status `pending`.

The checkout modal calls the existing wallet mutation after order creation. Wallet is only enabled for a single restaurant. The mutation result is authoritative; the modal does not show success before the debit settles.

## Realtime

The wallet resolver emits `PAYMENT_VERIFIED` through the existing payment realtime service after the transaction commits.

## Validation

- Deferred checkout unit test for wallet.
- Backend contract test for internal session shape and shared settlement usage.
- Frontend component/source contract test that the wallet card invokes the wallet mutation and does not fall through to success.
