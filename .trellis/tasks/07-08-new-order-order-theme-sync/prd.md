# Sync new order modal with Order Management UI

## Current behavior

The manager new-order modal opens correctly but visually reads as a separate product surface. It uses sage/teal accents, oversized menu cards, soft customer-facing radii and a spacious promotional header while the surrounding Order Management screen uses a compact cream, brown and gold operational system.

The browser console also reports that Ant Design Select `popupClassName` is deprecated.

## Root cause

The latest modal polish file was intentionally created against the Customer Management visual system. It hardcodes green/sage values and larger card proportions instead of reusing the existing Order Management palette and control rhythm. The mismatch is therefore at the modal theme boundary, not in order data or business logic.

## UI flow

1. `OrderManagement.jsx` renders the manager order screen and opens `NewOrderModal` from the **Đơn mới** action.
2. `NewOrderModal.jsx` imports the base modal SCSS, polish override and Ant Design Select override.
3. The shared `Modal` portals the dialog to `document.body`, so page-local Sass variables do not inherit into it.
4. The modal continues to use existing order, floor, table, menu and category hooks unchanged.

## Files changing

- `src/components/Dashboard_Manager/Order/components/NewOrderModal.scss`: align base modal color tokens with the exact Order Management cream, brown, gold, text and border family.
- `src/components/Dashboard_Manager/Order/components/NewOrderModalPolish.scss`: replace customer/sage overrides with a compact Order Management visual pass and keep responsive, focus and reduced-motion states.
- `src/components/Dashboard_Manager/Order/components/NewOrderSearchSelect.scss`: align Select fields and popup with Order Management controls.
- `src/components/Dashboard_Manager/Order/components/NewOrderModal.jsx`: replace deprecated `popupClassName` with `classNames.popup.root`.

## Acceptance criteria

- Modal and surrounding order page share the same cream, brown and gold palette.
- Primary actions use the same brown gradient as the Order Management **Đơn mới** action.
- Filters use the same 12–13px radius, border and focus treatment as Order Management controls.
- Menu cards are denser and no longer resemble large customer storefront cards.
- Teal/sage no longer acts as the modal primary accent.
- Ant Design Select no longer logs the `popupClassName` deprecation warning.
- Existing order creation, draft restore, restaurant scoping and responsive behavior remain unchanged.

## Out of scope

- No backend, GraphQL, Apollo hook or order mutation changes.
- No new dependency or shared design-system abstraction.
- No redesign of the parent Order Management page.

## Validation plan

- Run the existing `NewOrderModal` component test.
- Run the frontend build.
- Browser smoke at desktop and 390x844 / 430x932 when an executable checkout is available.
