# Design

## Direction

A calm operations ledger: warm off-white surfaces, sage controls, restrained amber/red alerts, strong numeric hierarchy, and compact data density. The screen should feel like a control room rather than a stack of unrelated cards.

## Information architecture

1. Inventory health overview and section shortcuts.
2. Count command area with creation fields and active-count progress.
3. Available-stock workspace with search, status chips, sorting, and responsive table.
4. Two-column operations area for document reconciliation and recent movements.

## Interaction rules

- Use anchors and native controls instead of adding routing or modal state.
- Keep all mutation handlers and variables unchanged.
- Use native `progress` for count completion.
- Convert dense desktop tables to labelled mobile cards through `data-label` attributes and CSS.
- Keep status text alongside color and icons.

## Files

- `src/components/Dashboard_Manager/Storage/components/inventory/InventoryAuditTab.jsx`
- `src/components/Dashboard_Manager/Storage/components/inventory/InventoryAuditTab.scss`
