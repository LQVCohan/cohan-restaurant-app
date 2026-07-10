# Orderable supplies across ordering surfaces

## Problem

`Supply` already represents non-ingredient stock such as bottled water and stores `pricePerUnit`, but ordering catalog queries and checkout hydration only understand `MenuItem + Recipe`. Adding supply cards only in the frontend would therefore fail when saving the order.

## Expected behavior

- Active supplies with a positive selling price are exposed as orderable catalog entries.
- Supply availability is based on `StockItem.onHand - StockItem.reserved`.
- Supplies are shown in POS, manager new-order, staff ordering, customer restaurant menu, and public table QR ordering.
- Supplies remain available in every meal time slot and are not copied into breakfast/lunch/dinner/late-night menus.
- A supply order line stores its own type/id and uses its supply price as the authoritative checkout price.
- Reserving, cancelling, and committing an order updates supply stock through the same warehouse transaction boundary as menu ingredients.
- Menu management clearly explains that sellable supplies are managed in inventory and appear in all time slots.

## Constraints

- Preserve existing menu-item and recipe behavior.
- Default catalog queries remain unchanged unless the caller explicitly requests supplies.
- Do not expose inactive, deleted, zero-price, or out-of-stock supplies as orderable.
- Do not allow modifiers or recipe-specific behavior for supply lines.

## Acceptance criteria

1. A bottled-water supply with `isActive=true`, `pricePerUnit>0`, and available stock appears for every selected time slot.
2. POS, staff, customer restaurant menu, and table QR ordering can add and submit that supply.
3. Checkout rejects an unavailable supply and uses the server-side supply price.
4. Inventory reservation/commit/cancel affects `StockItem.supplyId` without changing ingredient behavior.
5. Menu management displays a clear explanation of the cross-time-slot supply rule.
