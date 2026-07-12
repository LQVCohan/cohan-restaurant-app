# Customer named-menu selector

## Current behavior and root cause

A restaurant can now own multiple named menus in one service time slot, but the customer menu page still treats `timeSlot` as the only selection. Public item and category queries therefore aggregate every active menu in the slot. Customers cannot distinguish Menu VIP, Menu tiêu chuẩn or Menu ăn chơi, and the detail route does not preserve a menu choice.

## End-to-end flow

`Menu restaurantId + timeSlot + id` -> public active-menu query -> customer menu selector -> exact `menuId` in category and item filters -> MenuItem detail URL/state -> back to the same restaurant, slot and menu.

## Scope

1. Add a public `customerMenus` query that always returns active menus only.
2. Let `customerMenuCategories` accept an optional exact `menuId` while preserving time-slot aggregation for existing callers.
3. Add a second selector level below the four service slots for named menus.
4. Filter categories and dishes by the selected menu.
5. Disable service slots with no active menu after menu data loads.
6. Distinguish no-menu, no-dish, loading and request-error states.
7. Preserve `menuId` in the customer menu URL, food-detail route state and fallback back navigation.
8. Keep the current cart, ordering, booking-slot validation, promotions, preferences and availability behavior unchanged.

## Acceptance criteria

1. Two active dinner menus appear as separate customer choices.
2. Selecting Menu VIP only requests categories and dishes for Menu VIP.
3. Hidden/inactive menus never appear, including when the viewer has manager permissions.
4. Existing callers that omit `menuId` still receive aggregated same-slot categories.
5. Opening a dish and returning restores the same restaurant, time slot and menu.
6. Slots without an active menu cannot lead customers into a misleading generic empty result.
7. The result summary says how many dishes are currently displayed, not an incorrect total count.
8. Keyboard, focus, touch, loading, error and phone-width behavior remain usable.

## Out of scope

- VIP entitlement, table package, reservation tier, invite-code or price-access rules.
- Moving dishes between menus.
- Changing the four fixed time-slot values.
- Cart, checkout, deposit or order mutation changes.
- New dependencies or a new design system.

## Validation plan

- `cd cohan-restaurant-backend && npx vitest run tests/resolvers/menu-multi-slot.test.js tests/resolvers/public-customer-permission-flows.test.js`
- `npx vitest run src/components/Customer/RestaurantMenu/components/MenuDetailView.test.jsx src/utils/customerFoodNavigation.test.js`
- `npm run check:graphql`
- `npm run build`
- Manual review at 390x844, 430x932, 768, 1024 and 1440 when a browser runtime is available.
