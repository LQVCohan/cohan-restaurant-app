# Design

## Flow

1. `Supply` + `StockItem.supplyId` remain the single source of truth.
2. Menu catalog queries accept an opt-in `includeSupplies` flag.
3. A shared backend mapper exposes sellable supplies through the existing `MenuItem` GraphQL shape with `itemType=SUPPLY`, `supplyId`, one `unit` serving variant, and stock-derived status.
4. Order/cart inputs carry `itemType` and `supplyId` so hydration can branch before recipe lookup.
5. Supply hydration validates restaurant ownership, active state, price, and stock, then creates a server-authoritative order snapshot without modifiers or ingredient recipe lines.
6. Inventory services reserve/cancel/commit either ingredient needs or supply needs in the same transaction.
7. Ordering callers opt into supply catalog entries; manager menu keeps normal meal-menu pagination and receives an explanatory banner instead of editable synthetic cards.

## Why this approach

- Avoids duplicating bottled water into four meal menus.
- Reuses existing menu cards and cart/order UI.
- Keeps menu management mutations scoped to real `MenuItem` records.
- Makes the backend authoritative for price and stock.

## Files

- Backend contracts/models: menu, order, cart schemas and models.
- Backend services: orderable supply catalog, order hydration, inventory reservation.
- Backend resolvers: menu queries/fields, cart add flow, public table order inventory line mapping.
- Frontend: shared menu hook, staff order query, customer menu/table queries and mapping, manager menu notice.
- Tests: targeted catalog/hydration/inventory tests where feasible.
