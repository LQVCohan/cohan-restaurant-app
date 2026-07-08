# Inventory unit conversion

## Current behavior

- `QuickStockModal` exposes units connected to an ingredient base unit, but `toBaseQty` only handles part of the `kg/g` and `l/ml` directions and ignores custom `Ingredient.conversions`.
- `useIngredients.receiveStock` rounds converted quantities to integers before calling GraphQL.
- Ingredient stock GraphQL mutations use `Int`, while supply stock mutations already use `Float`; `StockItem` still rejects decimal balances for both domains.
- The low-stock receipt action reuses `QuickStockModal` but calls `adjustStock`, dropping selected unit, price, lot, expiry and supplier metadata.
- `RecipeModal` multiplies entered quantity directly by `costPerBaseUnit`, so its cost preview is wrong whenever the selected recipe unit differs from the ingredient base unit.

## Root cause

Unit conversion is duplicated and incomplete at frontend callers, while the shared stock contract still assumes integer quantities even though valid base units include `kg` and `l`. The same modal therefore produces different results depending on which UI action opened it.

## End-to-end flow

`Ingredient(baseUnit, conversions) / StockItem quantities -> inventory GraphQL schema -> stock resolvers and inventory.service -> inventory.gql/useIngredients -> QuickStockModal, RecipeModal and StorageManagement low-stock action`.

## Scope

- Replace the narrow frontend converter with a bidirectional graph using explicit ingredient conversions plus built-in metric edges.
- Expose only units that can be converted to the selected ingredient base unit.
- Reuse one receipt calculation for quantity in base units and cost per base unit.
- Make all ingredient stock mutation quantity inputs `Float` and allow finite decimal StockItem/batch quantities.
- Preserve decimal recipe requirements rather than rounding every requirement up to one whole base unit.
- Route low-stock receipts through `receiveStock` so unit, price and batch metadata are preserved.
- Correct RecipeModal cost previews by converting each component quantity to its ingredient base unit.

## Acceptance criteria

- `2 kg` with `baseUnit = g` stores `2000 g`; `500 g` with `baseUnit = kg` stores `0.5 kg`.
- A custom conversion such as `1 pack = 12 piece` works in both directions when the ingredient supplies that conversion.
- Unsupported units are not offered and conversion failure blocks submission instead of silently treating units as equal.
- Quantity, batch quantity, movement quantity and cost use the same converted base quantity.
- Low-stock quick receipt writes an inbound movement and retains price, lot, expiry and supplier details.
- Recipe cost preview uses base-unit quantity.
- Supply inbound/outbound/transfer remains in the supply canonical unit but accepts valid decimal quantities consistently with its existing Float schema.

## Out of scope

- Automatic migration or reinterpretation of historical stock balances.
- Adding arbitrary packaging conversion editing to the ingredient form.
- Currency, FIFO/FEFO ordering or warehouse permission changes.
- Visual redesign of storage screens.

## Validation

- Targeted frontend Vitest for bidirectional/default/custom conversions and receipt pricing.
- Targeted backend validation for decimal StockItem and batch quantities.
- GraphQL schema check.
- Frontend component/unit checks and build through CI.
