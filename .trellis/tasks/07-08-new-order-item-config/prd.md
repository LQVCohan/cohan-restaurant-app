# New order item configuration

## Current behavior

The manager new-order modal reads a legacy `preparationMethods` field that is not part of the current `MenuItem` GraphQL contract. Serving choices never appear, adding an item always uses quantity `1`, cart controls always step by `1`, and the card ignores `thumbImage`.

## End-to-end flow

1. `MenuItem` stores `defaultServingKey`; recipe-backed menu queries expose `servingVariants` with mode, unit, quantity and price.
2. `OrderItemInput` already accepts float quantity, serving key, serving snapshot and weight grams.
3. Order item hydration resolves the selected variant and validates weighted items in grams.
4. `useMenuManagement` already queries the required serving data.
5. `useOrderManagement.addToOrder` already supports variant, serving key, unit, decimal kg quantity and integer portion quantity.
6. `NewOrderModal.DishCard` is the incorrect boundary because it reads `preparationMethods`, hardcodes quantity `1`, and does not pass the selected serving variant.

## Scope

- Build the item configuration panel from `servingVariants`.
- Select the configured default serving variant.
- Accept decimal kg quantities in `0.1` steps and integer portion quantities in `1` steps.
- Pass variant, serving key, unit and quantity to the existing add-to-order flow.
- Use unit-aware steps in cart controls.
- Preserve serving and identity fields in modal drafts.
- Use `thumbImage` before the fallback icon.
- Improve icon contrast without changing the page palette.

## Files changing

- `src/components/Dashboard_Manager/Order/components/NewOrderModal.jsx`
- `src/components/Dashboard_Manager/Order/components/NewOrderModalPolish.scss`
- `src/components/Dashboard_Manager/Order/components/NewOrderSearchSelect.scss`
- `src/components/Dashboard_Manager/Order/components/NewOrderModal.test.jsx`

## Out of scope

- No model, GraphQL schema, resolver, pricing, inventory, permission or realtime changes.
- No new dependency or shared abstraction.
- No modifier-group UI in this modal.

## Acceptance criteria

- Clicking a menu card or plus button opens an item configuration panel.
- Serving options are visible and selectable.
- The configured default option is selected initially.
- Weighted items accept decimal kg quantities and use `0.1` steps.
- Portion items normalize to positive integers and use `1` steps.
- Cart lines retain the selected variant and quantity.
- Cart quantity controls respect the item unit.
- Items without a valid serving option cannot be submitted and show a clear message.
- Menu thumbnails use `thumbImage` when available.
- Filter and card icons are visible against the light surface.

## Validation plan

- Run the focused Vitest file for `NewOrderModal`.
- Run the frontend build when an executable checkout is available.
- Browser-smoke the configuration and cart flow when available.
