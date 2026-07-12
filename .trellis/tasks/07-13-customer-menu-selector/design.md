# Design

## Visual direction

Warm customer-menu surfaces with a compact two-level selector: meal-period tabs first, then horizontally scrollable named-menu choices. The active menu uses the existing amber emphasis plus a text check state; no new palette or component library.

## State model

- `timeSlot`: one of the four existing service periods.
- `selectedMenuId`: exact active menu within the selected period.
- `slotMenus`: active public menus filtered by `timeSlot`.
- Selection fallback: requested URL menu when valid, otherwise the first active menu in that slot.
- Category and item queries skip until an exact menu is resolved.
- The customer-menu route is replaced with `restaurantId + timeSlot + menuId` after a valid selection resolves.

## Compatibility

- `customerMenus` is public and always active-only.
- `customerMenuCategories(menuId)` is exact when supplied and keeps the current same-slot aggregation when omitted.
- Existing table-order, restaurant-detail, cart and standalone food-detail contracts remain unchanged.
- Normal browser/app history returns from dish detail to the exact customer-menu URL and selection.
