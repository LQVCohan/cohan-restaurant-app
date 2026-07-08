# Design

## Backend boundaries

### Live state

`MenuItemLiveStateInput.itemType` keeps its non-null contract but defaults to `MENU_ITEM`. The cart live-state resolver normalizes and returns the same type so GraphQL callers and result payloads cannot drift.

### Public modifier catalog

`modifierGroups` treats the default active-only query as public catalog data. It verifies that the restaurant is publicly available, filters inactive groups/options and returns only groups applicable to the requested menu item. Any inactive/internal listing still requires restaurant access.

### Cart modifier snapshot

Cart items persist only validated snapshots needed by the customer and checkout:

- group/option IDs and names;
- server-resolved price rule;
- resulting modifier price per unit.

The add-cart mutation loads applicable active groups, validates required/min/max/single rules, rejects duplicate or non-applicable selections, calculates the authoritative unit price from the selected serving variant and modifier rules, and includes modifier identity in cart-line deduplication.

Checkout maps stored snapshots back to `selectedModifiers`; existing `hydrateCheckoutOrderItems` remains authoritative for order pricing and inventory rule application.

### Safe ingredient summary

`MenuItem.ingredientNames` resolves distinct ingredient names from the active recipe without exposing quantities, costs or kitchen notes. The field is requested only on food detail.

## Frontend

### Menu

`MenuDetailView` keeps time-slot/category/search controls, adds a compact sort selector, searches name and description, and always opens dish detail. Ordering availability is communicated on the card but does not create a navigation dead end.

`MenuItemCard` presents status, preference warning/recommendation, promotion, preparation time and price range. It remains a native button-like article with keyboard operation and visible focus.

### Food detail

`FoodDetailV2` replaces the route implementation while reusing existing contexts/hooks:

- direct/deep-linkable customer dish query;
- restaurant status and active promotions;
- public modifier groups with required/default selection;
- preference/allergen panel;
- live inventory polling and Socket.IO refresh;
- server-authoritative add-to-cart;
- favorite, share, note, quantity, buy-now and cart drawer;
- actual portion, preparation and ingredient data;
- review summary and recent reviews;
- loading, missing, error and closed-restaurant states.

The layout uses the existing customer cream/orange visual language, a two-column desktop arrangement, sticky purchase panel, single-column mobile flow, explicit focus-visible states and reduced-motion rules.

## Tests

- backend resolver test for default/returned live-state item type;
- backend cart modifier validation/pricing/identity coverage;
- public modifier permission test;
- frontend menu card closed-restaurant navigation test;
- frontend food-detail modifier validation and share fallback helper tests;
- GraphQL operation and production build checks.
