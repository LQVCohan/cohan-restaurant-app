# Seed ingredient stock for Cohan Restaurant

## Current behavior

Restaurant `69ce9e2e8d8d711f12e251b1` has ingredient master data, but a complete inbound stock seed is still needed so inventory availability and movement history can be calculated from actual `StockItem` and `StockMovement` records.

## Root cause

Ingredient records alone do not create usable inventory. The inventory read path uses `StockItem.onHand - reserved`, while history and date-based calculations use `StockMovement.createdAt`. A correct seed must therefore write both the stock row and the matching inbound movement, using the same restaurant, warehouse, ingredient, quantity, cost, lot, and received date.

## End-to-end flow

1. `Ingredient` provides `baseUnit`, `minStock`, `costPerBaseUnit`, activity, and deletion state.
2. The seed selects every active, non-deleted ingredient scoped to restaurant `69ce9e2e8d8d711f12e251b1`.
3. The seed resolves an existing active `Warehouse` in that restaurant.
4. `StockItem` is upserted with `onHand`, preserved `reserved`, cost, note, and a batch.
5. A matching `StockMovement` is created with type `inbound`, today's Vietnam date, lot, cost, total value, supplier note, and before/after stock metadata.
6. Existing GraphQL stock queries and order availability calculations read the resulting stock without schema or resolver changes.

## Scope

- Add one backend seed script dedicated to this restaurant.
- Use all active ingredients currently stored in MongoDB rather than duplicating ingredient definitions in the script.
- Default to validation only; require `--apply` before any write.
- Use the first active warehouse, with optional `--warehouseId=...` override.
- Preserve existing reserved quantities.
- Top up stock only; never reduce an existing higher balance.
- Prevent duplicate inbound rows when rerun on the same Vietnam calendar date.
- Add npm commands for validate and apply modes.

## Files to change

- `cohan-restaurant-backend/scripts/seedRestaurantIngredientStock.js`: build, validate, and apply the scoped stock plan.
- `cohan-restaurant-backend/package.json`: expose validate/apply commands.
- `.trellis/tasks/07-08-restaurant-ingredient-stock/task.json`: task state.
- `.trellis/tasks/07-08-restaurant-ingredient-stock/prd.md`: task contract and verification plan.

## Acceptance criteria

- The script refuses an invalid or unexpected restaurant.
- Every active, non-deleted ingredient is included in the plan.
- Every write is scoped by restaurant, warehouse, and ingredient.
- Stock quantities are integers in the ingredient base unit.
- Existing `reserved` values are preserved.
- Each applied row has a batch and matching inbound movement.
- Movement metadata contains received date, lot, cost, total value, ingredient name, unit, and stock before/after values.
- Running apply twice on the same Vietnam date does not create duplicate seed movements.
- No model, resolver, GraphQL schema, permission, or UI file changes.

## Out of scope

- Creating a warehouse automatically.
- Repairing ingredient categories, units, prices, duplicate ingredient names, or incorrect master data.
- Seeding supplies or recipes.
- Changing FIFO/FEFO consumption logic.

## Validation plan

- Run `node --check cohan-restaurant-backend/scripts/seedRestaurantIngredientStock.js`.
- Parse `cohan-restaurant-backend/package.json` as JSON.
- Run validate mode against the configured MongoDB before apply when credentials are available.
- Review the changed lines to confirm stock and movement values stay aligned.
