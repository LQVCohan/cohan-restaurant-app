# Design

Use the existing payment transaction and settlement boundaries; add no new service layer.

- Add one review-state assertion shared by verify/reject.
- Validate and round VND received amount before any persisted success state.
- Execute rejection payment/order changes in one MongoDB transaction.
- Keep verification settlement inside its existing transaction, remove the duplicate `Order.updateMany`, and let settlement be the only order-release writer.
- In settlement idempotency, accept an existing transaction only when its `externalRef` matches the current payment reference; otherwise reject the reused transaction ID.
- Keep the modal mounted on errors and render the same mutation error inline.
- Align the manager route permission with `payment.read`.
