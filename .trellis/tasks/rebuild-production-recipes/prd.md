# Rebuild production recipes

## Scope

Recreate and verify recipes for the 36 seeded dishes in each of these restaurants:

- `69ce9e2e8d8d711f12e251b1` — Cohan Restaurant
- `6a447f6bea9844b4c8544c4f` — Cohan Restaurant 2

Both restaurants must remain scoped to brand `6a447f6bea9844b4c8544c49`.

## Current behavior and root cause

The production catalog already contains the authoritative ingredient definitions, serving variants, prices, quantities and waste percentages. It upserts ingredients before creating recipes, so missing ingredient records can be restored without inventing a second catalog.

The previous rebuild verified restaurant scope and ingredient ownership, but did not verify semantic dish-to-ingredient correctness. A recipe could therefore pass the technical checks without proving that `Phở bò tái` contains both `Bánh phở tươi` and `Thịt bò`.

The Recipe contract supports `menuItemId`, `servingVariants.ingredients` and `notes`. No schema, resolver, Apollo or UI change is required.

## Flow traced

`Ingredient/Menu/MenuItem/Recipe models -> production catalog seed -> Recipe menuItemId and ingredient ObjectIds -> inventory GraphQL query/mutation -> useRecipes -> Recipe list/detail UI`.

## Implementation

- Reuse `seedProductionRecipes.js --apply`; it runs the existing production catalog first, so missing ingredients are upserted before recipes are checked.
- Add `seedProductionRecipeBindings.js` as the public recipe command.
- Define 36 explicit binding contracts using the production dish code, expected name, time slot and core ingredient names.
- Resolve each item by `restaurantId + code`, verify its name and menu time slot, then require exactly one active Recipe linked by `menuItemId`.
- Resolve each recipe ingredient ObjectId inside the same restaurant and require every serving variant to include the dish's core ingredients.
- Keep the operation idempotent and require explicit `--apply` for database writes.

## Acceptance criteria

- Validation reports exactly 36 unique binding contracts.
- `PHO-BO-TAI` explicitly requires `Bánh phở tươi` and `Thịt bò`.
- Missing ingredient records are restored before recipe verification through the existing catalog seed.
- Every target MenuItem is found by its restaurant-prefixed production code and has the expected name and time slot.
- Every target MenuItem has exactly one active Recipe with the same restaurantId and menuItemId.
- Every serving variant references only ingredients from the same restaurant and contains all core ingredients required by its dish.
- Apply verifies 36 recipes per restaurant without creating duplicate recipes.
- No database write occurs without `--apply`.

## Out of scope

- Recipe schema redesign or structured cooking-step fields.
- Frontend changes.
- Changing existing quantities, prices or stock balances outside the authoritative catalog seed.

## Validation

```bash
node --check scripts/seedProductionRecipeBindings.js
node scripts/seedProductionRecipeBindings.js --validate-only
vitest run tests/scripts/seed-production-recipes.test.js
```

The connected MongoDB apply command is intentionally not run from this environment.
