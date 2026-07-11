# Design

## Real flow

1. `Promotion` stores restaurant scope, promotion type, targets, dates and usage counters.
2. Promotion mutations sanitize and persist manager input under `promotion.write` permission.
3. `usePromotions` maps backend fields into the manager form and sends create/update/delete operations.
4. The manager screen edits, duplicates, toggles and filters promotions.
5. Active promotion hooks feed menu badges and POS/payment selectors.
6. `calculateDiscountBreakdown` is the authoritative pricing boundary: it queries active promotion documents, calculates ITEM/CATEGORY/BOGO and selected ORDER discounts, and returns the final payable total.
7. Customer off-premise checkout already uses that boundary, while reservation deposits and table add-on orders currently bypass it.
8. Menu cards and menu detail remain descriptive surfaces; exact payable prices belong in cart/checkout/booking summaries because eligibility can depend on the whole cart.

## Root fixes

- Put active-capacity filtering on the Promotion model query boundary so every `find`/`findOne` request with `isActive: true` receives the same usage-limit rule.
- Keep type/reference validation in the mutation trust boundary, where restaurant permission and submitted IDs are available.
- Keep frontend state synchronization in `usePromotions`, the shared boundary used by the management screen.
- Extend the existing active order-promotion normalizer instead of creating another selector hook.
- Reuse `calculateDiscountBreakdown` for reservation-linked cart pricing and newly created dine-in order batches instead of duplicating promotion formulas.
- Persist reservation food pricing as three explicit values: original subtotal, promotion discount and payable total.
- Base the food deposit on the payable total, never on an amount supplied by the client.
- Persist applied promotion IDs in order totals and increment usage in the same database session as order creation.
- Expose a customer-safe preview query that accepts cart items, hydrates server prices/modifiers and returns the same breakdown shape used at checkout.
- For reservation add-ons, compare the created order payable total with the reservation pricing snapshot. Reject a drift instead of silently charging a different amount.

## Customer UX rules

- Menu item cards display the promotion badge/name and conditions but do not promise a final discounted unit price.
- Checkout displays automatic promotion discount and coupon discount as separate lines.
- Booking summary displays food subtotal, automatic promotion discount, payable food total and the 50% food deposit.
- During preview loading, the UI states that promotion pricing is being verified; the server response remains authoritative.
- If eligibility changes before confirmation, show the server error and ask the customer to review the cart rather than proceeding with stale pricing.

## Compatibility

- Existing management queries with `activeOnly: false` continue to return exhausted promotions for reporting.
- `findById`, edit, delete and analytics access remain unaffected by active-capacity middleware.
- Existing off-premise checkout remains authoritative and gains correct promotion usage accounting when no coupon is present.
- Existing reservation fields remain available; new linked-menu pricing fields are additive.
- No new dependencies.
