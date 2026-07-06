# Rebuild production recipes

## Scope

Recreate recipes for the 36 seeded dishes in each of these restaurants:

- `69ce9e2e8d8d711f12e251b1` — Cohan Restaurant
- `6a447f6bea9844b4c8544c4f` — Cohan Restaurant 2

Both restaurants must remain scoped to brand `6a447f6bea9844b4c8544c49`.

## Current behavior and root cause

The menu items and ingredients still exist, but the recipe records were deleted. The existing production catalog seed already contains the authoritative serving variants, prices, ingredient quantities and waste percentages; recreating a second copy of those definitions would introduce drift.

The Recipe contract supports `servingVariants` plus a free-text `notes` field. The manager recipe UI reads the variants for costing and presents the recipe note as preparation guidance. No schema, resolver, Apollo or UI change is required.

## Flow traced

`Recipe/MenuItem/Ingredient models -> inventory GraphQL Recipe and UpsertRecipeInput -> recipe mutation/query -> useRecipes/recipe GraphQL operations -> Recipe list/detail UI`.

## Implementation

- Reuse `seedProductionMenuCatalogWithMenus.js --apply` to recreate missing recipes and their ingredient variants from the existing authoritative catalog.
- Add a recipe-only wrapper that validates all 36 dish guides, runs the catalog recreation, then writes detailed Vietnamese preparation notes to the recreated recipe records.
- Match recipes by restaurant-scoped `MenuItem.name`; fail when any dish or recipe is missing or duplicated.
- Keep the operation idempotent and require explicit `--apply` for database writes.

## Acceptance criteria

- Validation reports exactly 36 unique preparation guides.
- Apply recreates or restores exactly one active recipe per menu item for both restaurants.
- Each recipe keeps its existing serving variants, pricing, ingredient quantities and waste percentages.
- Each recipe receives non-empty sections for preparation, cooking, finishing and quality standards.
- Re-running apply updates the same 72 recipe records without creating duplicates.
- No database write occurs without `--apply`.

## Out of scope

- Recipe schema redesign or structured cooking-step fields.
- Frontend changes.
- Changing menu items, prices, ingredient costs or stock quantities beyond the existing idempotent catalog seed.

## Validation

```bash
node --check scripts/seedProductionRecipes.js
node scripts/seedProductionRecipes.js --validate-only
```

The connected MongoDB apply command is intentionally not run from this environment.
