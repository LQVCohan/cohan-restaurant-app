# Resolve real default serving variant for customer stock checks

## Current behavior and root cause

The recipe editor stores a serving variant with its own stable `key` such as `default`, while `portion` is the selling unit for a portion-based variant.

The customer food page may temporarily or historically send `servingVariantKey=portion`. Both the live-stock query and add-to-cart mutation currently treat `portion` as the fallback variant key. Inventory lookup requires an exact recipe variant key, so a valid recipe whose default key is `default` fails with:

`ServingVariant not found ... (servingKey=portion)`

## Flow traced

`Recipe servingVariants schema -> recipe upsert and MenuItem cache sync -> customerMenuItem query -> FoodDetailV2 selection -> menuItemLiveState/addCartItem -> inventory.service exact variant lookup`.

## Implementation

- Keep exact requested recipe keys unchanged.
- When the requested key is empty, or is the legacy fallback `portion` and no exact `portion` variant exists, resolve the recipe variant marked `isDefault`, then the first variant.
- Return/store the resolved recipe key so stock checks, cart holds and later releases use one identity.
- Continue rejecting any other unknown explicit key.
- Do not change recipe data, ingredient quantities, inventory formulas or GraphQL schema.

## Acceptance criteria

- A recipe with default variant key `default` can be checked when a legacy client sends `portion`.
- `menuItemLiveState.servingVariantKey` returns `default` in that case.
- `addCartItem` reserves and stores `default` in that case.
- A real recipe variant keyed `portion` still resolves exactly.
- An unknown explicit key such as `missing-size` still fails.

## Validation

```bash
cd cohan-restaurant-backend
npx vitest run tests/resolvers/customer-serving-variant-resolution.test.js
```
