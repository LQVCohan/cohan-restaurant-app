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
- Bind Cohan Restaurant to the four confirmed menu IDs and verify restaurant/time-slot ownership before any catalog write.
- Create the four missing time-slot menus for Cohan Restaurant 2 using the existing unique key `restaurantId + timeSlot`.
- Replace development wording in the confirmed breakfast and late-night menu names/descriptions with production copy.
- Create realistic Vietnamese restaurant names and descriptions without demo/test/dev wording.
- Populate all four menu time slots, dish categories, ingredient categories, ingredients, recipe variants and usable stock.
- Include portion-only, kilogram-only and mixed portion/kilogram dishes.
- Include `Cá đục nướng muối ớt` at `150000` VND per portion and `400000` VND per kilogram.
- Keep recipe and denormalized menu-item pricing fields synchronized.
- Require explicit `--apply` before database writes.
- Provide a no-database `--validate-only` check.

## Confirmed Cohan Restaurant menus

- breakfast: `69fe7335ce835ed35b6b90b9`
- lunch: `69ce9e348d8d711f12e2521d`
- dinner: `69ce9e348d8d711f12e25220`
- late_night: `69fe7341ce835ed35b6b91ea`

## Acceptance criteria

- Catalog validation reports at least one dish in each selling-mode group.
- Every referenced ingredient exists in the seed catalog.
- Recipe variant keys are unique per dish and exactly one variant is default.
- `PORTION` uses `portion`; `BY_WEIGHT` uses `g` or `kg`.
- Re-running the apply command updates the same records instead of duplicating them.
- No external image URL is invented or hotlinked.

## Files

- `cohan-restaurant-backend/scripts/seedProductionMenuCatalog.js`: catalog, validation and idempotent upsert.
- `cohan-restaurant-backend/scripts/seedProductionMenuCatalogWithMenus.js`: validates confirmed menu IDs, normalizes production menu copy, creates missing menus for the second restaurant, then runs the catalog seed.
- `cohan-restaurant-backend/package.json`: runnable npm commands.

## Validation

```bash
node --check scripts/seedProductionMenuCatalog.js
node --check scripts/seedProductionMenuCatalogWithMenus.js
node scripts/seedProductionMenuCatalog.js --validate-only
```

Database apply is intentionally not run without the user's connected MongoDB environment.
