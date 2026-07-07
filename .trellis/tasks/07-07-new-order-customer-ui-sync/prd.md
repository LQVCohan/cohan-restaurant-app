# New order modal customer UI sync

## Current behavior

The manager new-order modal works, but its visual hierarchy is assembled from three different style layers: the original cream/gold SCSS, a separate polish SCSS, and a late sage CSS override. The result is visually close to the manager pages but still inconsistent with Customer Management: the header and control area feel flatter, summary cards use a different rhythm, dish cards are too dense at wide desktop widths, and the cart drawer introduces a darker visual system.

## End-to-end flow

1. `CreateOrderForTableInput` and `createOrderForTable` define the existing dine-in creation contract.
2. `useOrderManagement.saveOrder()` builds and submits the mutation payload.
3. `NewOrderModal` selects a floor, available table, menu slot and dishes, then invokes `saveOrder({ persist: true, restaurantId })`.
4. The modal reports success, clears the draft, refreshes the order page and closes.

No contract, permission, validation or realtime change is required.

## Visual reference

Reuse the Customer Management system:

- Primary sage: `#1f6a60`; hover: `#17554d`.
- Charcoal: `#24323b`.
- Warm canvas: `#f8f5ee`; surface: `#fffdfa`.
- Sage surface: `#f2faf7`; warm surface: `#f7f1e8`.
- Border: `#d8d0c5`.
- Container radii around 22–26px; inner controls around 14–18px.
- Tinted shadows and clear keyboard focus rings.

## Scope

- Consolidate the final visual behavior in `NewOrderModalPromotionTheme.css` instead of rewriting the component or base SCSS.
- Match the modal shell, header, control surface, summary metrics, filters, session tabs, menu metadata, dish cards, loading/empty states and cart drawer to Customer Management.
- Keep desktop density useful: prefer four readable dish cards over five cramped cards at typical manager widths.
- Preserve responsive behavior and touch targets.
- Replace remaining visible English loan wording such as `order` with consistent Vietnamese wording.

## Acceptance criteria

1. The modal clearly belongs to the same product family as Customer Management.
2. One warm-neutral/sage palette is used throughout; dark surfaces remain limited to strong actions and do not create a separate theme.
3. Header, controls and menu list have clear surface hierarchy without excessive nested cards.
4. Dish cards are readable and use consistent 18–20px radii, light borders and subtle tinted shadows.
5. Search/select/session controls have visible hover, active and focus-visible states.
6. The cart drawer uses the same warm surface and sage/charcoal accents.
7. The UI remains usable at 1180px, 980px, 700px, 430×932 and 390×844.
8. Schema, resolver, hook, mutation payload, draft restore and order save behavior are unchanged.

## Validation

- `npx vitest run src/components/Dashboard_Manager/Order/OrderManagement.test.jsx`
- `npm run build`
- Manual keyboard/focus review of selects, search, session tabs, dish cards, cart controls and close button.
- Desktop screenshot plus 430×932 and 390×844 when browser automation is available.

## Out of scope

- Changing the order creation GraphQL contract or backend resolver.
- Changing menu filtering, pricing, cart calculations or table availability rules.
- Adding dependencies, animations or a new component abstraction.
