# Fix homepage cart server sync false error

## Current behavior and root cause

The Home `DishGrid` successfully calls `addCartItem`, and the backend commits the cart item and returns the authoritative `Cart`. The component then performs a second client-side lookup using an exact `menuItemId + servingVariantKey + note` match. When that duplicate lookup does not find the returned line, the UI reports a sync failure and skips its local cart update even though the server mutation succeeded.

`CartProvider` already owns server-to-local cart synchronization through `myCart`, including `backendCartId`, `backendCartItemId`, hold metadata and live menu hydration. The Home component bypasses that shared path and duplicates part of it.

## End-to-end flow

`CartItemSchema -> CustomerCartMutation.addCartItem -> CartItemFieldResolvers -> AddCartItemFromHome -> CartProvider ServerCartBridge -> DishGrid button`.

## Files changing and why

- `src/components/Customer/Homepage_Client/components/DishGrid.jsx`: remove the duplicate returned-item matching/local payload construction and refresh the authoritative server cart after a successful mutation.
- `src/components/Customer/Homepage_Client/components/DishGrid.comboCta.test.js`: keep a small regression check that the Home flow uses `refetchServerCart` and no longer contains the false sync-error branch.

## Acceptance criteria

1. A successful `addCartItem` response no longer displays “Không thể đồng bộ dòng giỏ hàng từ máy chủ”.
2. The cart is refreshed from the authoritative `myCart` query after the mutation.
3. Backend cart item IDs and hold metadata continue to enter local cart state through `CartProvider`.
4. Mutation errors still display the backend/network error message.
5. No GraphQL schema, inventory reservation, restaurant capability, permission or realtime behavior changes.

## Out of scope

- Changing the cart schema or resolver payload.
- Adding a new cart abstraction or dependency.
- Changing the five-minute inventory hold policy.
