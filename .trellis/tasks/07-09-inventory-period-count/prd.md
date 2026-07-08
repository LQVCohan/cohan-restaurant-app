# Period inventory count and document reconciliation

## Current state

The storage inventory tab shows current ingredient balances and recent stock movements. It does not create a count period, collect physical counted quantities, close a period, post adjustment movements, or track whether paper documents match inbound/outbound movements.

## Goal

Add a minimal period-count workflow inside the existing inventory tab:

1. Create a count session for one restaurant and one warehouse.
2. Snapshot system stock by ingredient for the selected period.
3. Enter counted quantities and notes.
4. Close the count session and post signed `adjustment` movements for variances.
5. Mark inbound/outbound/adjustment/transfer movements as document `pending`, `matched`, `mismatch`, or `missing` with a document number and note.

## End-to-end flow

`InventoryCount model + StockMovement.meta.document* -> inventory GraphQL schema -> inventoryCount resolver -> inventory.gql -> StorageManagement -> InventoryAuditTab`.

## Scope

- Ingredient stock only for period count, because current inventory audit tab already operates on ingredient `stockItems` and `stockMovements`.
- Reuse existing `StockItem`, `StockMovement`, `Ingredient`, `Warehouse` and permissions.
- No new dependency and no new top-level route.
- Use existing storage UI visual language and tab.

## Acceptance criteria

- Manager can create a count session for the selected warehouse and period.
- Session lines show system quantity, counted quantity, variance and note.
- Closing the session updates `StockItem.onHand` to counted quantity by posting variance adjustment movements.
- Closed sessions cannot be edited or closed again.
- The document reconciliation panel lists recent movements and lets the user set document number/status/note.
- Reconciled document status is stored on the movement meta and shown in the UI.

## Out of scope

- File upload/OCR for invoices or paper documents.
- Accounting approval workflow.
- Supply stock period count.
- Historical inventory valuation migration.
- Locking sales/order operations during count.
