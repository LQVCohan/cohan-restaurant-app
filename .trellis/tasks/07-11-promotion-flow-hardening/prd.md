# Promotion flow hardening

## Problem

Promotion management currently permits contract drift between the manager form, GraphQL resolver, stored document and runtime discount selection. Invalid references can be stored, restaurant changes appear to succeed when they do not, exhausted promotions can reach discount calculation, and supported COMBO/FREESHIP promotions are hidden from POS selectors.

The customer application flow also has inconsistent pricing boundaries:

- Menu cards can show an active ITEM/CATEGORY promotion badge, but checkout only previews coupon discounts.
- Off-premise checkout applies automatic promotions on the backend, while `createOrderForTable` still stores base totals.
- Reservation add-on food deposits are calculated from the cart's undiscounted subtotal.
- Promotion usage is only incremented in some checkout paths when a coupon is also present.

This can make the price shown before confirmation differ from the order total and can make a reservation food deposit higher than 50% of the food amount actually payable.

## Scope

- Validate and normalize promotion fields at the backend trust boundary.
- Ensure referenced categories and menu items belong to the promotion restaurant.
- Preserve restaurant ownership on update and report attempted moves clearly.
- Exclude exhausted promotions from active runtime queries before preview/payment.
- Use authoritative mutation results in the frontend hook.
- Use the dedicated toggle mutation for status-only changes.
- Make duplicate codes deterministic and collision-resistant within the loaded restaurant list.
- Surface mutation errors through the existing promotion error banner.
- Include COMBO and FREESHIP in active order-promotion selectors.
- Apply automatic ITEM/CATEGORY/BOGO promotion pricing to customer dine-in add-on orders.
- Calculate reservation food deposits from the backend-authoritative food total after automatic promotions.
- Expose a customer-safe discount preview used by checkout and booking summaries.
- Increment promotion usage transactionally even when no coupon is selected.

## Acceptance criteria

- Invalid type, scope, discount type, level, dates or cross-restaurant references are rejected before persistence.
- Updating a promotion cannot silently move it to another restaurant.
- Frontend filters follow the restaurant returned by the server, never the submitted restaurant value.
- Status-only changes call `togglePromotion` and do not resubmit the full promotion.
- Promotions at their usage limit are absent from active calculation queries.
- POS selectors can display percentage, fixed, combo and freeship order promotions.
- ITEM/CATEGORY promotion badges are visible in both normal customer menu and booking add-on menu.
- Customer checkout shows automatic promotion discount separately from coupon discount.
- A reservation with linked food stores the original food subtotal, promotion discount and payable food total.
- The food portion of a reservation deposit equals 50% of the payable food total after automatic promotions.
- The linked dine-in order uses the same promotion rules as the reservation pricing snapshot; a changed price is rejected instead of silently charging a different amount.
- Promotion usage reaches the same result with or without a coupon.
- Create, update, toggle, delete, duplicate, active-query, preview, reservation-deposit and order-application behavior have focused regression tests.

## Out of scope

- Redesigning the promotion management page.
- Allowing a customer to manually choose ITEM/CATEGORY promotions.
- Displaying a fake discounted unit price on menu cards when eligibility depends on cart quantity, minimum order value, modifiers or stacking.
- Changing coupon formulas, invoices or payment providers.
- Adding new audience-segmentation semantics that are not currently represented by customer data contracts.
