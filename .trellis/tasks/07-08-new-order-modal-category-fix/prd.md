# New order modal category fix

## Current behavior

Opening the manager **Đơn mới** modal throws `TypeError: (... || []).forEach is not a function` in `buildNewOrderCategoryOptions`, leaving the page blank.

## Root cause

`Menu.categoryMenu` is a single `CategoryMenu` object used to group a menu. It is not the list of dish `Category` records referenced by `MenuItem.categoryId`. The modal treated that object as an array and attempted to iterate it.

## End-to-end flow

1. `Category` is stored per restaurant and referenced by `MenuItem.categoryId`.
2. GraphQL `categories(restaurantId, timeSlot)` resolves the scoped dish-category list through `CategoryQuery.categories` and `requireRestaurantAccess`.
3. `useCategoryManagement` already exposes that list to React.
4. `OrderManagement` opens `NewOrderModal` for the selected restaurant.
5. The modal builds category filter options and filters menu items before saving through the unchanged order workflow.

## Scope

- Reuse `useCategoryManagement` in `NewOrderModal`.
- Build category options from actual dish categories.
- Keep orphaned or uncategorized menu items under one `Khác` option.
- Update the focused helper tests to use the real contract.

## Files changing

- `src/components/Dashboard_Manager/Order/components/NewOrderModal.jsx`: replace the incorrect nested `categoryMenu` assumption with the existing category query hook.
- `src/components/Dashboard_Manager/Order/components/NewOrderModal.test.jsx`: validate category option construction against the real category shape.

## Out of scope

- No GraphQL schema or resolver changes.
- No changes to order creation, permissions, restaurant scoping, drafts, realtime events, or modal styling.
- No new dependency or abstraction.

## Acceptance criteria

- Opening **Đơn mới** no longer throws during render.
- Active dish categories appear by their real names.
- Unknown and uncategorized item category IDs remain grouped under one `Khác` option.
- Existing order creation flow remains unchanged.

## Validation plan

- Run the focused Vitest file for `NewOrderModal`.
- Run a frontend build if the environment permits.
