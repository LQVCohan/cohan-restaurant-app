# Fix featured dish card overflow

## Current behavior

On the desktop customer homepage, `DishGrid` renders four compact horizontal cards inside the shared 1080px homepage container. The grid switches column count from viewport breakpoints, not from the width available to each card. At the reported desktop scale, each card becomes too narrow and its `overflow: hidden` clips the price/action footer, especially the **Chọn món** button.

## Root cause

`src/styles/Homepage/DishGrid.scss` uses `repeat(4, minmax(0, 1fr))`. The parent container width is capped in `HomePremiumPolish.scss`, so a wide viewport does not guarantee enough card width. Fixed-width footer content then exceeds the narrow card body.

## End-to-end flow checked

1. `cohan-restaurant-backend/graphql/schema/menu.graphql` exposes `topMenuItems` and `MenuItem` fields.
2. `cohan-restaurant-backend/graphql/resolvers/menu/query.js` filters and returns public orderable menu items.
3. `DishGrid.jsx` queries eight items, derives availability/variant price, and renders each dish action.
4. `Home.jsx` mounts `DishGrid` inside the desktop homepage.
5. `HomePremiumPolish.scss` caps the shared homepage content container at 1080px.
6. `DishGrid.scss` controls the card grid and causes the visual overflow.

The data and action contracts are correct; this task changes only the shared grid layout rule.

## Scope

- Make the featured dish grid choose its column count from available container width.
- Preserve the existing card design, query, cart mutation, keyboard behavior, loading state, and breakpoints.
- Change the fewest runtime files.

## Acceptance criteria

- Price and **Chọn món** remain fully visible on desktop at the reported layout width.
- Cards do not create horizontal overflow.
- The grid naturally reduces columns before card content becomes cramped.
- Existing two-column/single-column responsive behavior remains usable.
- No GraphQL, resolver, cart, availability, or navigation behavior changes.

## Out of scope

- Homepage redesign.
- New card component or layout abstraction.
- Changes to menu-item data, sorting, availability, or cart logic.
- New dependencies.

## Validation plan

- Run the existing DishGrid targeted Vitest test.
- Run the frontend build.
- Compare the homepage at desktop and narrow breakpoints when a browser environment is available.
