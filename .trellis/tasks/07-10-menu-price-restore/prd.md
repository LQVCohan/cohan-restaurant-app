# Persistent menu price restore

## Current behavior and root cause

Bulk price updates write directly to `Recipe.servingVariants.price` and synchronize `MenuItem.basePrice`. The modal reset action only restored local React state before save. Existing audit entries stored the operation and final base price, but not a restorable per-variant snapshot. After save or reload, the previous price was therefore unavailable.

## Caller flow

`AuditLog/Recipe/MenuItem -> menu price history service -> menu and recipe resolver wrappers -> GraphQL restore mutation -> PriceEditModal action -> targeted backend test`.

## Scope

- Persist before/after variant prices for bulk and manual recipe price adjustments.
- Allow restoring the latest active saved price snapshot for checked menu items after reload.
- Keep restaurant scoping, update-price permission checks, auditability, and `MenuItem.basePrice` synchronization.

## Files changed

- `cohan-restaurant-backend/models/audit-log.model.js`: index active price snapshots.
- `cohan-restaurant-backend/src/services/menuPriceHistory.service.js`: shared record and restore logic.
- `cohan-restaurant-backend/graphql/schema/menu.graphql`: restore contract.
- `cohan-restaurant-backend/graphql/resolvers/menu/priceHistoryMutation.js`: record bulk snapshots and expose restore mutation.
- `cohan-restaurant-backend/graphql/resolvers/menu/index.js`: wire menu price history mutations.
- `cohan-restaurant-backend/graphql/resolvers/inventory/recipePriceHistoryMutation.js`: record manual recipe price changes.
- `cohan-restaurant-backend/graphql/resolvers/inventory/index.js`: wire recipe price history mutation.
- `src/components/Dashboard_Manager/Menu/components/PriceEditModal/PriceEditModal.jsx`: restore checked items from the database.
- `cohan-restaurant-backend/tests/services/menuPriceHistory.service.test.js`: snapshot and restore regression checks.

## Acceptance criteria

1. Saving a price change creates a database record containing previous and new prices by serving-variant key.
2. Reloading the page does not remove the restore capability.
3. Restoring checked items writes the previous prices back to `Recipe`, refreshes `MenuItem.basePrice`, and marks the snapshot restored.
4. A new price change supersedes an older still-active snapshot for the same item.
5. Users outside the restaurant scope or without menu price permission cannot restore prices.

## Out of scope

Automatic restore at a configured future time is not included in this bug fix. It requires a separate scheduling control and due-job path.

## Validation plan

- Targeted Vitest service test for record and manual restore.
- GraphQL schema check.
- Frontend build if available.
