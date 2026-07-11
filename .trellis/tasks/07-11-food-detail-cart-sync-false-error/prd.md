# Fix FoodDetail false cart sync error

## Current behavior and root cause

`addCartItem` commits the inventory hold and returns the updated cart. The live-state panel and cart badge therefore increase correctly, but `FoodDetailV2` still displays “Không nhận được dòng giỏ hàng đã đồng bộ từ máy chủ.”

The cart model stores the resolved recipe variant key as `CartItem.servingKey`. GraphQL exposes it as `CartItem.servingVariantKey` through `CartItemFieldResolvers`. The cart resolver module exports that resolver, but the root resolver composition registers only `Cart` and drops `CartItem`. GraphQL therefore returns a null serving key, Apollo/CartProvider falls back to `portion`, and the FoodDetail exact client-side lookup cannot match a server line whose resolved key is `default`.

## End-to-end flow

`CartItemSchema.servingKey -> CartItemFieldResolvers.servingVariantKey -> root graphql/resolvers/index.js -> addCartItem/MyCart GraphQL payload -> CartProvider ServerCartBridge -> FoodDetailV2 add action`.

## Files changing and why

- `cohan-restaurant-backend/graphql/resolvers/index.js`: include the already-exported `CartItem` field resolver in the executable resolver map.
- `cohan-restaurant-backend/tests/resolvers/cart-resolver-composition.test.js`: prove the root resolver map exposes `CartItem.servingVariantKey` and maps stored `servingKey` correctly.

The frontend is intentionally unchanged: once the shared GraphQL contract returns the real resolved key, both the mutation response and `myCart` use the existing synchronization path correctly. This is smaller and also fixes every other cart consumer that currently receives the incorrect `portion` fallback.

## Acceptance criteria

1. A successful add from FoodDetail no longer shows a sync error for a recipe whose real default key is `default`.
2. A cart item stored with `servingKey=default` is returned as `servingVariantKey=default` through the root GraphQL resolver map.
3. Mutation and `myCart` payloads share the same CartItem field resolver.
4. Backend inventory holds, five-minute TTL, restaurant scoping, permissions and checkout behavior remain unchanged.
5. No frontend workaround, new dependency or cart abstraction is added.

## Out of scope

- Changing inventory reservation calculations or hold TTL.
- Changing GraphQL schema fields.
- Redesigning the FoodDetail UI.
