# Optimize customer menu live stock reads

## Current behavior and root cause

The food detail page requests `menuItemLiveState` on first load, every 10 seconds, and after matching `inventoryEvents`.

The resolver currently waits for these steps sequentially:

1. Read the current user's cart.
2. Read all active carts containing matching holds.
3. Resolve the default warehouse.
4. Calculate ingredient availability.

The availability helper also starts a MongoDB transaction even when it is only reading Recipe, Ingredient and StockItem data. That transaction is unnecessary for a display-only snapshot because the final add-to-cart path still uses an atomic conditional update inside its own transaction.

Rapid inventory events can also cause duplicate refetch calls from the same food detail page.

## End-to-end flow

`Recipe/Ingredient/StockItem/Cart schemas -> inventory.service -> cart menuItemLiveState resolver -> MENU_ITEM_LIVE_STATE Apollo query -> FoodDetail quantity controls -> addCartItem atomic reservation`.

## Implementation

- Keep the existing ingredient-based availability formula and GraphQL response unchanged.
- When `checkAvailabilityForLinesTx` receives an existing session, continue using that session. When no session is provided, perform plain lean reads without opening a read-only transaction.
- Start the user-cart query, reserved-cart query and warehouse/availability calculation concurrently in `menuItemLiveState`.
- Preserve all current hold filtering, abuse metadata and viewer-count behavior.
- Coalesce matching Socket.IO inventory events on a food detail page into one short delayed refetch and prevent overlapping event-driven refetches.
- Keep the 10-second polling fallback and the atomic add-to-cart reservation unchanged.

## Acceptance criteria

- `checkAvailabilityForLinesTx` does not call `mongoose.startSession()` for a normal read.
- Passing a session still applies it to Recipe, Ingredient and StockItem reads.
- `menuItemLiveState` starts independent database work concurrently and returns the same fields and values as before.
- Expired, released and serving-variant-mismatched holds remain excluded.
- Multiple inventory events received in a short burst cause at most one event-driven refetch per page instance.
- Adding the final available item remains protected by `StockItem.updateOne` with the existing atomic `onHand - reserved >= need` condition.
- No schema, database migration, dependency or inventory formula change is introduced.

## Out of scope

- Redis or a custom application cache.
- Persisting a denormalized menu-item stock count.
- Changing polling freshness or the five-minute cart hold policy.
- Replacing the existing Socket.IO event contract.

## Validation

```bash
cd cohan-restaurant-backend
npx vitest run tests/services/inventory-availability-read.test.js tests/resolvers/cart-access.test.js
cd ..
npm run build
```
