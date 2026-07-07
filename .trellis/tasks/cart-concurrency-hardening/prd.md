# Harden concurrent cart reservations

## Current behavior and root cause

`reserveForOrderTx` already protects the last sellable unit with an atomic MongoDB condition on `onHand - reserved`. The cart resolver, however, catches every reservation error and converts it to `OUT_OF_STOCK`. A transient MongoDB write conflict can therefore be shown as a false stock-out and can incorrectly publish a menu out-of-stock event.

The cart model also states that one user has one active cart, but the current `{ userId, status }` index is not unique. Two devices using the same account can both observe no active cart and create separate active carts.

## End-to-end flow

`Cart/StockItem schemas -> inventory.service reserveForOrderTx -> CartMutation.addCartItem/updateCartItem -> ADD_CART_ITEM Apollo mutation -> FoodDetail error mapper and notification`.

## Implementation

- Recognize only the canonical insufficient-reservation error from `reserveForOrderTx` as a real stock shortage.
- Convert only a real shortage to GraphQL `OUT_OF_STOCK` and publish the out-of-stock event.
- Map an escaped duplicate-key/write-conflict error to `CART_CONFLICT_RETRY`; do not publish out-of-stock.
- Map an unknown transaction commit result to `CART_STATE_UNKNOWN`, instructing the customer to reload the cart before another action instead of risking a duplicate retry.
- Add a unique partial index so a user can have only one cart whose status is `active`, while retaining multiple historical checked-out or abandoned carts.
- Keep the atomic stock condition, transaction, five-minute hold, GraphQL schema and frontend contract unchanged.

## Acceptance criteria

- Two different users competing for one remaining unit result in one success and one `OUT_OF_STOCK`; inventory never goes negative because the existing atomic reservation remains the source of truth.
- A technical reservation failure is not converted to `OUT_OF_STOCK` and does not publish an out-of-stock event.
- MongoDB write conflicts return `CART_CONFLICT_RETRY` rather than a false stock-out.
- An unknown commit result tells the customer to reload instead of blindly retrying the write.
- Two requests for the same user cannot create two active carts after the unique partial index exists.
- A duplicate-key race during active-cart creation returns a retryable cart conflict.
- Historical carts remain allowed.
- No GraphQL schema or frontend change is required.

## Deployment note

The new unique index can only be created when existing data has no duplicate active carts for the same user. This change does not automatically discard or merge production carts. Database index creation was not run from this environment.

## Validation

```bash
cd cohan-restaurant-backend
npx vitest run tests/resolvers/cart-concurrency.test.js tests/resolvers/cart-access.test.js
npm run build
```
