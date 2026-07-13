# Customer proof waiver

A staff member or POS cashier may record that a customer does not require a proof image for an individual by-weight order item while the incoming QR order is still pending.

The waiver is stored in `order.clientMeta.proofWaivers[orderItemId]` with the actor, timestamp, reason and trusted source. It bypasses only the image requirement. A valid `weightGrams` value remains mandatory for `BY_WEIGHT` items.

Uploading a real proof image later removes the waiver automatically. Every waiver change is appended to the order timeline and emits `ORDER_ITEM_PROOF_WAIVER_UPDATED`.
