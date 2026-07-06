# Production recipe stock seed

## Scope

Seed ingredient stock for the 36 production dishes in each Cohan restaurant from the active Recipe records that were verified by the production recipe binding seed.

Target restaurants:

- `69ce9e2e8d8d711f12e251b1` — Cohan Restaurant
- `6a447f6bea9844b4c8544c4f` — Cohan Restaurant 2

## Current behavior and root cause

`MenuItem.maxAvailable` and `menuItemLiveState.maxAvailableQty` are not stored menu-item fields. They are calculated from Recipe ingredient quantities and `StockItem.onHand - StockItem.reserved`.

The existing catalog seed inserts arbitrary initial ingredient quantities only when a StockItem is first created. Re-running it does not recalculate stock after recipes change, and the generic demo stock seed fills by unit instead of by actual dish recipes.

## Flow traced

`Ingredient/Recipe/StockItem schemas -> inventory.service and menuItemInventoryAvailability.service -> MenuItem GraphQL fields/menuItemLiveState -> customer menu and food detail quantity limits`.

For a selling variant, the application calculates each ingredient requirement in its base unit, includes waste percentage, then derives availability from the limiting ingredient:

`floor((onHand - reserved) / requiredForOneSellUnit)`.

## Implementation

- Run `seedProductionRecipeBindings.js --apply` first so both restaurants have the verified 36 dishes, recipes and ingredient references.
- Read every active serving variant from those recipes.
- Build an aggregate stock plan from actual recipe quantities, units and waste percentages.
- Default plan: 30 selling units for every PORTION variant and 5 selling units for every BY_WEIGHT variant. Both values are configurable by command arguments.
- Seed the first active warehouse, matching the warehouse selection used by `menuItemLiveState`.
- Set `onHand` to planned available stock plus the current reserved quantity, preserving active reservations.
- Keep stock above Ingredient.minStock where required so seeded sellable items are not immediately marked LOW_STOCK.
- Record an adjustment StockMovement for every changed StockItem.
- Require explicit `--apply`; validation mode does not connect to MongoDB.

## Acceptance criteria

- Validation accepts positive integer portion and weight targets and performs no database writes.
- Apply fails unless each restaurant has exactly 36 production MenuItems and 36 active Recipes.
- Every recipe variant has at least one valid ingredient line.
- Every referenced Ingredient belongs to the same restaurant and can be converted to its base unit.
- Stock is derived from all recipe variants rather than hard-coded ingredient quantities.
- Existing reservations are preserved by setting `onHand = plannedAvailable + reserved`.
- Re-running apply is idempotent for StockItem balances; unchanged balances do not create movements.
- The script reports restaurants, recipes, variants, referenced ingredients and changed stock rows.

## Out of scope

- Adding a separate menu-item stock field.
- Changing inventory availability or order reservation formulas.
- Allocating a private stock pool per dish; ingredients remain shared across recipes.
- Clearing active reservations or stock in unrelated warehouses.

## Validation

```bash
node --check scripts/seedProductionRecipeStock.js
node scripts/seedProductionRecipeStock.js --validate-only
vitest run tests/scripts/seed-production-recipe-stock.test.js
```

The connected MongoDB apply command is not run from this environment.
