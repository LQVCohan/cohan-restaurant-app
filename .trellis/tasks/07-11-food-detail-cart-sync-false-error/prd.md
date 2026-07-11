# Fix FoodDetail false cart sync error

## Current behavior and root cause

`addCartItem` commits the inventory hold and returns the updated cart. The live-state panel and cart badge therefore increase correctly, but `FoodDetailV2` still displays “Không nhận được dòng giỏ hàng đã đồng bộ từ máy chủ.”

The cart model stores the resolved recipe variant key as `CartItem.servingKey`. GraphQL exposes it as `CartItem.servingVariantKey` through `CartItemFieldResolvers`. The cart resolver module exports that resolver, but the root resolver composition registers only `Cart` and drops `CartItem`. GraphQL therefore returns a null serving key, Apollo/CartProvider falls back to `portion`, and the FoodDetail exact client-side lookup cannot match a server line whose resolved key is `default`.

`FoodDetailV2` also duplicates server-cart synchronization by rebuilding a local line after the mutation. `CartProvider` already owns authoritative `myCart` synchronization, and `DishGrid` already follows that pattern.

## End-to-end flow

`CartItemSchema.servingKey -> CartItemFieldResolvers.servingVariantKey -> root graphql/resolvers/index.js -> addCartItem/MyCart GraphQL payload -> CartProvider ServerCartBridge -> FoodDetailV2 add action`.

## Files changing and why

- `cohan-restaurant-backend/graphql/resolvers/index.js`: include the exported `CartItem` field resolver in the executable resolver map.
- `src/components/Customer/Food/FoodDetailV2.jsx`: remove duplicate exact-line matching/local upsert and refetch the authoritative server cart after a successful mutation.
- `src/components/Customer/Food/FoodDetailV2.helpers.test.jsx`: remove the obsolete helper test and assert the shared refetch path remains.
- `cohan-restaurant-backend/tests/resolvers/cart-resolver-composition.test.js`: prove the root resolver map exposes `CartItem.servingVariantKey` and maps stored `servingKey` correctly.

## Acceptance criteria

1. A successful add from FoodDetail no longer shows a sync error.
2. A cart item stored with `servingKey=default` is returned as `servingVariantKey=default` through the root GraphQL resolver map.
3. FoodDetail refreshes `myCart` through `CartProvider` after the mutation.
4. Backend inventory holds, five-minute TTL, restaurant scoping, permissions and checkout behavior remain unchanged.
5. No new dependency or cart abstraction is added.

## Out of scope

- Changing inventory reservation calculations or hold TTL.
- Changing GraphQL schema fields.
- Redesigning the FoodDetail UI.
