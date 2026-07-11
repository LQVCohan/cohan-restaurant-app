# Design

## Real flow

1. `Promotion` stores restaurant scope, promotion type, targets, dates and usage counters.
2. Promotion mutations sanitize and persist manager input under `promotion.write` permission.
3. `usePromotions` maps backend fields into the manager form and sends create/update/delete operations.
4. The manager screen edits, duplicates, toggles and filters promotions.
5. Active promotion hooks feed menu badges and POS/payment selectors.
6. `calculateDiscountBreakdown` queries active promotion documents, calculates discounts, and payment/order transactions atomically increment usage counters.

## Root fixes

- Put active-capacity filtering on the Promotion model query boundary so every `find`/`findOne` request with `isActive: true` receives the same usage-limit rule.
- Keep type/reference validation in the mutation trust boundary, where restaurant permission and submitted IDs are available.
- Keep frontend state synchronization in `usePromotions`, the shared boundary used by the management screen.
- Extend the existing active order-promotion normalizer instead of creating another selector hook.

## Compatibility

- Existing management queries with `activeOnly: false` continue to return exhausted promotions for reporting.
- `findById`, edit, delete and analytics access remain unaffected by active-capacity middleware.
- No schema changes or new dependencies.
