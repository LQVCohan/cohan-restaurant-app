# Fix customer menu search layout

## Current behavior

At desktop widths around the supplied 1068px screenshot, the customer menu header keeps the back button, restaurant summary, search, sort control, and view toggle on one row. The action column is allowed to be only 300px wide, so the flex layout shrinks the search field until only the icon and a small circular input remain visible.

## Root cause

`MenuDetailViewPolish.scss` defines the third header grid column as `minmax(300px, 0.52fr)`. That column also contains the sort control and view toggle. The search query, debounce, GraphQL filter, resolver search condition, and `MenuItem` fields are already connected correctly; the defect is the shared header layout boundary.

## Caller flow

1. `cohan-restaurant-backend/models/menuitem.model.js` stores searchable `name` and `description` fields.
2. `cohan-restaurant-backend/graphql/schema/menu.graphql` exposes `MenuItemFilter.search`.
3. `cohan-restaurant-backend/graphql/resolvers/menu/query.js` applies the search value to `menuItemsConnection`.
4. `src/components/Customer/RestaurantMenu/components/MenuDetailView.jsx` debounces the input and passes it in the Apollo filter.
5. `src/components/Customer/RestaurantMenu/styles/MenuDetailViewPolish.scss` controls the broken header sizing.

## Scope

Change only `src/components/Customer/RestaurantMenu/styles/MenuDetailViewPolish.scss` so the action column reserves enough width for a usable search field while preserving existing responsive breakpoints and controls.

## Acceptance criteria

- The search input remains visibly usable near the supplied 1068px viewport.
- Sort and grid/list controls remain on the same row at desktop sizes.
- Existing 1024px, 900px, and 640px responsive behavior remains intact.
- No GraphQL, resolver, component state, or dependency changes are introduced.

## Out of scope

- Redesigning the menu header.
- Changing search semantics or debounce timing.
- Restyling the sort select or view toggle beyond what is required to prevent search collapse.
