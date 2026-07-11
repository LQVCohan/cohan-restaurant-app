# Design

Use the existing payment transaction and settlement boundaries; add no new service layer.

- Add one review-state assertion shared by verify/reject.
- Validate and round VND received amount before any persisted success state.
- Reload the reviewable payment inside the transaction so stale concurrent decisions cannot silently overwrite a completed review.
- Execute rejection payment/order changes in one MongoDB transaction.
- Keep verification settlement inside its existing transaction, remove the duplicate `Order.updateMany`, and let settlement be the only order-release writer.
- Before settlement, reject a provider transaction ID already attached to another payment reference.
- Keep the modal mounted on errors and render the same mutation error inline.
- Preserve the existing `payment.read` queue guard and `payment.write` decision guard.
