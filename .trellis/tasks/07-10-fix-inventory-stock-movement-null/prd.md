# Fix inventory StockMovement null contract

## Current behavior
Opening the inventory audit tab runs `StockMovements`. The resolver returns both ingredient and supply movements, but GraphQL declares `StockMovement.ingredientId` as non-null. Supply movements legitimately have `ingredientId = null`, so GraphQL aborts the list with `Cannot return null for non-nullable field StockMovement.ingredientId`.

## Root cause
The Mongoose model enforces exactly one of `ingredientId` or `supplyId`, while the GraphQL output type exposes only a required `ingredientId`. The schema contract drifted from the persisted model.

## Flow traced
`models/stock-movement.model.js` -> `graphql/resolvers/inventory/movement.query.js` -> `graphql/schema/inventory.graphql` -> `STOCK_MOVEMENTS_QUERY` -> `StorageManagement` -> `InventoryAuditTab`.

## Scope
- Make `StockMovement.ingredientId` nullable.
- Expose nullable `StockMovement.supplyId` so the GraphQL type represents both valid movement variants.

## Acceptance criteria
- Ingredient movements continue returning `ingredientId`.
- Supply movements may return `ingredientId: null` without failing the query.
- Existing authorization, restaurant scoping, ordering, and UI behavior remain unchanged.

## Out of scope
- Redesigning the audit UI to display supply movements.
- Data migration or deleting existing supply movement records.

## Validation
- Run the repository GraphQL schema check when available.
- Verify the schema matches the existing Mongoose XOR constraint.
