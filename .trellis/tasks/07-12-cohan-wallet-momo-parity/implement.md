# Implementation plan

1. Extend PaymentSession persistence for the internal Cohan wallet provider without changing external credential handling.
2. Correct the shared paid-order settlement method/provider fields, payment owner and per-order paid amounts.
3. Replace the duplicated wallet order settlement with an internal successful PaymentSession plus `settlePaidOrderPaymentSession` inside the existing wallet transaction.
4. Emit payment realtime after the wallet transaction commits.
5. Defer wallet checkout orders and wire the checkout wallet option to `payOrdersWithWallet`.
6. Add focused backend/frontend regression tests.
7. Re-fetch every target file from latest `main`, review callers and run the narrowest available GraphQL, Vitest and build checks.
