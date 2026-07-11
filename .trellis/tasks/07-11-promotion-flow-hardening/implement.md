# Implementation plan

1. Harden the Promotion model fields and attach a shared active-capacity query guard.
2. Validate mutation enums, dates, numeric ranges and restaurant-owned references before persistence.
3. Keep update ownership immutable and enable Mongoose validators on update/toggle.
4. Synchronize management operations with authoritative mutation results and route status-only changes through `togglePromotion`.
5. Extend the existing order-promotion selector normalizer for COMBO and FREESHIP.
6. Add a shared cart-pricing adapter that converts trusted cart snapshots into order pricing lines and delegates formulas to `calculateDiscountBreakdown`.
7. Update reservation creation to save linked food subtotal, promotion discount and payable total; calculate the food deposit from the payable total.
8. Apply automatic promotion pricing to new dine-in order batches before persistence, retain applied promotion IDs and increment usage in the order transaction.
9. Add a customer-safe discount preview query and reuse the existing `useDiscountPreview` boundary in checkout and booking pages.
10. Update checkout and booking summaries to show original subtotal, automatic promotion discount, coupon discount where relevant, payable total and food deposit.
11. Reject reservation add-on order creation when its authoritative payable total no longer matches the reservation snapshot.
12. Add focused backend and frontend regression tests, run CI, and document any checks that cannot execute.
