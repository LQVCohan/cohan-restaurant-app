# Harden concurrent cart reservations

## Current behavior and root cause

`reserveForOrderTx` already protects the last sellable unit with an atomic MongoDB condition on `onHand - reserved`. The cart resolver, however, catches every reservation error and converts it to `OUT_OF_STOCK`. A transient MongoDB write conflict can therefore be shown as a false stock-out and can incorrectly publish a menu out-of-stock event.

The cart model also states that one user has one active cart, but the current `{ userId, status }` index is not unique. Two devices using the same account can both observe no active cart and create separate active carts.

## End-to-end flow

`Cart/StockItem schemas -> inventory.service reserveForOrderTx -> CartMutation.addCartItem/updateCartItem -> ADD_CART_ITEM Apollo mutation -> FoodDetail error mapper and notification`.

## Implementation

- Give real reservation shortages a stable `INSUFFICIENT_STOCK` error code at the inventory service boundary.
- Convert only that code to GraphQL `OUT_OF_STOCK` and publish the out-of-stock event.
- Map an escaped duplicate-key/write-conflict error to `CART_CONFLICT_RETRY` with a user-facing retry message; do not publish out-of-stock.
- Retry active-cart creation once after a duplicate-key race, then reload the winning active cart.
- Add a unique partial index so a user can have only one cart whose status is `active`, while retaining multiple historical checked-out or abandoned carts.
- Keep the atomic stock condition, transaction, five-minute hold, GraphQL schema and frontend contract unchanged.

## Acceptance criteria

- Two different users competing for one remaining unit result in one success and one `OUT_OF_STOCK`; inventory never goes negative.
- A technical reservation failure is not converted to `OUT_OF_STOCK` and does not publish an out-of-stock event.
- MongoDB write conflicts return `CART_CONFLICT_RETRY` rather than a false stock-out.
- Two requests for the same user cannot create two active carts after the unique partial index exists.
- A duplicate-key race during cart creation retries once and uses the cart created by the competing request.
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
