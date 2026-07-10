# Persistent menu price restore

## Current behavior and root cause

Bulk price updates write directly to `Recipe.servingVariants.price` and synchronize `MenuItem.basePrice`. The modal reset action only restores local React state before save. Existing audit entries store the operation and final base price, but not a restorable per-variant snapshot. After save or reload, the previous price is therefore unavailable.

## Caller flow

`AuditLog/Recipe/MenuItem -> menu price history service -> menu GraphQL mutations -> useMenuManagement Apollo hook -> MenuManagement handlers -> PriceEditModal actions -> targeted backend tests`.

## Scope

- Persist before/after variant prices for every menu price adjustment.
- Allow restoring the latest active saved price snapshot for checked menu items.
- Allow bulk changes to optionally schedule automatic restore.
- Keep restaurant scoping, update-price permission checks, auditability, and `MenuItem.basePrice` synchronization.

## Files planned

- `cohan-restaurant-backend/models/audit-log.model.js`: index active/scheduled price snapshots.
- `cohan-restaurant-backend/src/services/menuPriceHistory.service.js`: shared record/restore logic.
- `cohan-restaurant-backend/graphql/schema/menu.graphql`: restore contract and optional restore time.
- `cohan-restaurant-backend/graphql/resolvers/menu/mutation.js`: record bulk snapshots and expose restore mutation.
- `cohan-restaurant-backend/graphql/resolvers/inventory/recipe.mutation.js`: record manual recipe price changes at the shared persistence boundary.
- `cohan-restaurant-backend/src/server/createServer.js`: run the existing minute sweep for due restores.
- `src/hooks/useMenuManagement.js`: Apollo restore mutation.
- `src/components/Dashboard_Manager/Menu/MenuManagement.jsx`: save/restore handlers.
- `src/components/Dashboard_Manager/Menu/components/PriceEditModal/PriceEditModal.jsx`: schedule selection and restore action.
- targeted test for snapshot/restore behavior.

## Acceptance criteria

1. Saving a price change creates a database record containing previous and new prices by serving-variant key.
2. Reloading the page does not remove the restore capability.
3. Restoring checked items writes the previous prices back to `Recipe`, refreshes `MenuItem.basePrice`, and marks the snapshot restored.
4. A new price change supersedes an older still-active snapshot for the same item, preventing an old timer from overwriting newer pricing.
5. A configured restore time is persisted and processed after backend restart by the minute job.
6. Users outside the restaurant scope or without menu price permission cannot restore prices.

## Validation plan

- Targeted Vitest service/resolver test for record, supersede, manual restore, and due restore.
- GraphQL schema check.
- Frontend build if available.
