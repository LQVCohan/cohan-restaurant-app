# Production menu catalog seed

## Scope

Create an idempotent data seed for these restaurants:

- `69ce9e2e8d8d711f12e251b1` — Cohan Restaurant
- `6a447f6bea9844b4c8544c4f` — Cohan Restaurant 2

Both must remain scoped to brand `6a447f6bea9844b4c8544c49`.

## Current behavior

The menu domain already supports:

- `MenuItem` scoped by restaurant, menu and category;
- one `Recipe` per menu item;
- `PORTION` and `BY_WEIGHT` serving variants;
- ingredient lines with quantity, unit and waste percentage;
- cached `basePrice`, `defaultServingKey` and `hasByWeightVariant` on `MenuItem`;
- inventory through `Ingredient`, `Warehouse` and `StockItem`.

Older seed scripts use legacy recipe fields and are not safe as the basis for current data.

## Flow traced

`MenuItem/Recipe/Ingredient/StockItem models -> GraphQL menu and inventory contracts -> createMenuItem/upsertRecipe resolvers -> useMenuManagement/useRecipes -> MenuItemModal`.

The requested change is data-only. No schema, resolver, Apollo or UI contract change is required.

## Requirements

- Upsert only; never delete or reset existing records.
- Verify both restaurants exist and belong to the expected brand before writing.
- Create realistic Vietnamese restaurant names and descriptions without demo/test/dev wording.
- Populate all four menu time slots, dish categories, ingredient categories, ingredients, recipe variants and usable stock.
- Include portion-only, kilogram-only and mixed portion/kilogram dishes.
- Include `Cá đục nướng muối ớt` at `150000` VND per portion and `400000` VND per kilogram.
- Keep recipe and denormalized menu-item pricing fields synchronized.
- Require explicit `--apply` before database writes.
- Provide a no-database `--validate-only` check.

## Acceptance criteria

- Catalog validation reports at least one dish in each selling-mode group.
- Every referenced ingredient exists in the seed catalog.
- Recipe variant keys are unique per dish and exactly one variant is default.
- `PORTION` uses `portion`; `BY_WEIGHT` uses `g` or `kg`.
- Re-running the apply command updates the same records instead of duplicating them.
- No external image URL is invented or hotlinked.

## Files

- `cohan-restaurant-backend/scripts/seedProductionMenuCatalog.js`: catalog, validation and idempotent upsert.
- `cohan-restaurant-backend/package.json`: runnable npm command.

## Validation

```bash
node --check scripts/seedProductionMenuCatalog.js
node scripts/seedProductionMenuCatalog.js --validate-only
```

Database apply is intentionally not run without the user's connected MongoDB environment.
