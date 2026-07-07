# Global search catalog and chef profiles

## Current behavior

- Desktop header uses `searchSuggestions` and `/search`, while mobile Home filters only `RestaurantGrid` even though its placeholder promises dish search.
- Restaurant search supports name, address, cuisine, and phone, but global search constructs raw regular expressions from user input.
- Menu search only checks `MenuItem.name` and `description`; it does not join Category or Recipe data.
- `SearchPage` expects `menuItem.restaurant`, but the GraphQL operation and `MenuItem` schema do not provide that field.
- Public search has no chef entity. OWNER remains admin-only and must not be repurposed.

## Root cause

The shared GraphQL search contract is incomplete and has drifted from both the resolver payload and the UI. Mobile Home also bypasses the shared search route.

## Scope

1. Escape all user-controlled regex input in the search resolver.
2. Search available menu items by:
   - dish name, description, code, and labels;
   - category name;
   - serving portion/unit and recipe variant name/key/unit/quantity;
   - recipe notes for cooking-method keywords.
3. Return restaurant, category name, serving label, and concise cooking-method labels with each menu result.
4. Add a public `CHEF` search entity backed by active kitchen staff assigned to a public restaurant.
5. Chef matching may use chef name/title, restaurant name, and the restaurant contact phone. It must not query or return the staff member's private phone.
6. Keep OWNER results restricted to administrators.
7. Make desktop suggestions, full SearchPage, and mobile Home use the same global search flow.
8. Add focused backend and frontend tests.

## Acceptance criteria

- Searching special characters such as `[`, `(`, `*`, or `a+a` does not throw or create an unbounded raw regex.
- Searching a category, serving label, or cooking method can return the matching menu item.
- Full menu results navigate with the associated restaurant ID and display restaurant/category/portion/cooking metadata.
- Searching a chef name, title, restaurant name, or restaurant contact phone can return a chef card.
- Public responses never contain a staff personal phone or email.
- Public OWNER behavior remains unchanged; admin OWNER behavior still works.
- Mobile Home submit navigates to `/search?q=...` instead of filtering only restaurants.
- GraphQL schema validation and targeted tests pass.

## Out of scope

- Atlas Search, Elasticsearch, fuzzy/accent-insensitive indexes, or a new search service.
- A new public chef-profile collection or CMS.
- Exposing full recipe SOP text to customers.
- Publishing staff personal contact details.
- Redesigning the entire search page or adding dependencies.
