# Optimize customer menu live stock reads

## Current behavior and root cause

The food detail page requests `menuItemLiveState` on first load, every 10 seconds, and after matching `inventoryEvents`.

The resolver previously waited for these independent operations sequentially:

1. Read the current user's cart.
2. Read all active carts containing matching holds.
3. Resolve the default warehouse.
4. Calculate ingredient availability.

When many customers receive the same inventory event, every request also repeated the same reserved-hold and ingredient-availability reads for the same restaurant, menu item and serving variant.

## End-to-end flow

`Recipe/Ingredient/StockItem/Cart schemas -> inventory.service -> cart menuItemLiveState resolver -> MENU_ITEM_LIVE_STATE Apollo query -> FoodDetail quantity controls -> addCartItem atomic reservation`.

## Implementation

- Keep the existing ingredient-based availability formula and GraphQL response unchanged.
- Start the user-cart query, reserved-hold query and warehouse/availability calculation concurrently in `menuItemLiveState`.
- Add request coalescing only while an identical reserved-hold or availability read is already in flight.
- Delete the in-flight entry immediately after success or failure, so this is not a stale-value cache.
- Preserve all existing hold filtering, abuse metadata, viewer-count behavior, 10-second polling and Socket.IO behavior.
- Keep the final add-to-cart transaction and atomic stock condition unchanged.

## Acceptance criteria

- `menuItemLiveState` starts independent database work concurrently and returns the same fields and values as before.
- Concurrent requests for the same restaurant, item and serving variant share one reserved-hold read and one availability read while those reads are in progress.
- A later request after completion performs a fresh read.
- Different serving variants do not share a result.
- Expired, released and serving-variant-mismatched holds remain excluded.
- Adding the final available item remains protected by `StockItem.updateOne` with the existing atomic `onHand - reserved >= need` condition.
- No schema, database migration, dependency, TTL cache or inventory formula change is introduced.

## Out of scope

- Redis or persistent application caching.
- Persisting a denormalized menu-item stock count.
- Changing polling freshness, Socket.IO contracts or the five-minute cart hold policy.
- Altering `inventory.service.js`; the existing atomic reserve path remains the source of truth.

## Validation

```bash
cd cohan-restaurant-backend
npx vitest run tests/resolvers/menu-item-live-state-performance.test.js tests/resolvers/cart-access.test.js
```
