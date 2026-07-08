# Complete customer menu and food detail ordering UX

## Current behavior and root causes

The customer menu and food-detail flow exposes most core dish data, but several cross-layer contracts are incomplete or inconsistent:

- `MenuItemLiveStateInput.itemType` and `MenuItemLiveState.itemType` are non-null in GraphQL while the current food-detail callers omit the input and the resolver omits the output.
- Modifier groups already exist for booking/POS order flows, but public customers cannot query them and cart items cannot retain validated modifier snapshots.
- The customer menu disables opening a dish whenever the restaurant cannot currently receive orders, even though customers still need to inspect the dish before ordering later.
- The food detail query omits serving portion/unit and ingredient names, then renders confident fallback copy that may be incorrect.
- The customer menu and restaurant-detail menu disagree on search, price display and closed-restaurant behavior.
- The old food detail page has a dead share button, unconditional “featured dish” copy and unclear async/error states.

## End-to-end flow

`MenuItem/Recipe/ModifierGroup/Cart models -> menu/cart/modifier GraphQL schema and resolvers -> Apollo menu, dish, modifier and cart operations -> MenuDetailView/MenuItemCard/FoodDetailV2 -> focused resolver/component tests`.

## Requirements

- Keep public browsing available without login; require a customer account only when adding to cart or buying now.
- Keep restaurant publication/orderability, restaurant scope, menu activity, stock reservation, abuse blocking and realtime inventory behavior authoritative on the backend.
- Make `MENU_ITEM` the default live-state type and return it consistently.
- Expose only active applicable modifier groups/options to public customers; keep inactive/internal reads permission-protected.
- Validate modifier group requirements and prices server-side, calculate the authoritative cart unit price on the server and preserve modifier selections through checkout.
- Allow customers to open dish details while a restaurant is closed; disable only ordering actions and show the reason.
- Display actual serving portion/unit, preparation time, ingredient names, diet/allergen labels, active promotion, review summary and live availability when data exists.
- Never invent “featured”, freshness, preparation-time or serving claims when data is missing.
- Support native sharing with clipboard fallback.
- Keep keyboard, focus-visible, live-region, mobile touch target and reduced-motion behavior.
- Reuse the current React/Apollo/SCSS stack and existing cart, promotion, preference and notification patterns.

## Acceptance criteria

1. GraphQL validation succeeds for every `menuItemLiveState` caller.
2. A public customer can browse active modifier groups for a dish, while inactive groups remain protected.
3. Required modifier selections are enforced before adding a dish, and the backend rejects invalid or forged selections/prices.
4. Cart lines with different modifier selections remain distinct and return modifier labels/prices to the frontend.
5. Checkout receives `selectedModifiers` from cart lines so existing order hydration remains the source of truth.
6. A closed restaurant still allows dish-detail navigation, but add/buy actions clearly explain why ordering is unavailable.
7. Menu search covers name and description; cards show a real selected/default price or “Từ …” for varying prices.
8. Food detail uses real serving and ingredient data and omits unsupported claims.
9. Share, favorite, quantity, add-to-cart, buy-now, cart drawer, review and availability states remain usable with keyboard and mobile layouts.
10. Focused backend/frontend tests and GraphQL/build checks pass, or any environment limitation is reported explicitly.

## Out of scope

- Nutrition/calorie calculations that are not present in the source data.
- New dependencies, a framework migration, Redis, or a new cart service.
- Changing the five-minute inventory hold policy.
- Exposing recipe quantities, costs or internal kitchen notes to customers.
