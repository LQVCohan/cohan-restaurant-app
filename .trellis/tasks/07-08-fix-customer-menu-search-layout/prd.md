# Fix customer menu search layout

## Current behavior

At desktop widths around the supplied 1068px screenshots, the customer menu header keeps the back button, restaurant summary, search, sort control, and view toggle on one row. The first fix reserved more width for the action column, which stopped the search field from collapsing into a circle, but the search placeholder is still clipped because the responsive layout does not move the action group to its own row until 1024px.

## Root cause

`MenuDetailViewPolish.scss` keeps the three-column header active too far into the intermediate desktop range. The action group contains three controls and needs the full row before the existing 1024px breakpoint. The search query, debounce, GraphQL filter, resolver search condition, and `MenuItem` fields are already connected correctly; the defect remains at the shared responsive layout boundary.

## Caller flow

1. `cohan-restaurant-backend/models/menuitem.model.js` stores searchable `name` and `description` fields.
2. `cohan-restaurant-backend/graphql/schema/menu.graphql` exposes `MenuItemFilter.search`.
3. `cohan-restaurant-backend/graphql/resolvers/menu/query.js` applies the search value to `menuItemsConnection`.
4. `src/components/Customer/RestaurantMenu/components/MenuDetailView.jsx` debounces the input and passes it in the Apollo filter.
5. `src/components/Customer/RestaurantMenu/styles/MenuDetailViewPolish.scss` controls the broken header sizing and breakpoint.

## Scope

Change only `src/components/Customer/RestaurantMenu/styles/MenuDetailViewPolish.scss` so the action group spans the full header row at intermediate widths while preserving the existing desktop and mobile controls.

## Acceptance criteria

- The complete search placeholder remains visible near the supplied 1068px viewport.
- Search, sort, and grid/list controls remain aligned on one full-width action row at intermediate widths.
- Wide desktop layout remains compact.
- Existing 900px and 640px responsive behavior remains intact.
- No GraphQL, resolver, component state, or dependency changes are introduced.

## Out of scope

- Redesigning the menu header.
- Changing search semantics or debounce timing.
- Changing the sort options or view-mode behavior.
