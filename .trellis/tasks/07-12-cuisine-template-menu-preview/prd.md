# Restaurant template menu structure preview

## Current behavior and root cause

The new-restaurant template picker previously showed cuisine, dish, ingredient and recipe counts, then exposed one flat dish list. It did not show which menus would be created, which service time each menu belonged to, or which dishes belonged to an exact menu.

The snapshot already stores exact menu references on every menu item, and the importer already identifies menus by `(timeSlot, name)`. The missing shared boundary was the template summary contract: it flattened menu items into `dishNames`, so the UI had no structured menu data to render.

## End-to-end flow

`restaurantCuisineTemplates definitions` -> snapshot `menuCatalog.menus/menuItems` -> `listCuisineTemplates()` builds exact menu previews -> `RestaurantInitialSetupQuery.restaurantCuisineTemplates` -> GraphQL `RestaurantCuisineTemplate` -> Apollo query in `RestaurantCuisineOnboarding` -> manager previews and applies the unchanged template mutation -> snapshot importer creates the selected package.

## Direction

Warm, compact starter-template picker that previews operational menu structure first: named menus grouped by service time, exact dish allocation, and one clear apply action. The page remains a cuisine selector, not a menu editor.

## Scope

1. Return a structured menu preview for every template: exact menu key, name, time slot, dish count and dish names.
2. Keep sibling menus separate when they share one service time.
3. Return the number of distinct service time slots.
4. Show menu count in the card metrics.
5. Replace the flat dish disclosure with menus grouped by the four service slots.
6. Preserve the flat dish list as a compatibility fallback when structured menu data is unavailable.
7. Explain that managers may create additional VIP, formal or casual menus in the same slot after setup.
8. Preserve the apply/skip mutation, permissions, pending state, snapshot contents and existing seven packages.

## Acceptance criteria

1. Existing seven cuisine packages keep the same menu, item, recipe and ingredient counts.
2. GraphQL summaries expose every menu and its exact dishes.
3. Two menus sharing one time slot are not collapsed in the summary or UI.
4. Every card displays menu, dish, ingredient and recipe counts.
5. The native disclosure shows menu names, service-slot labels and dishes assigned to each menu.
6. Empty structured previews fall back to the existing flat dish list instead of rendering broken content.
7. Selecting, dismissing, reopening, applying and skipping continue to work unchanged.
8. Keyboard focus, native radio/`details`, visible focus, loading/error states and mobile bottom-sheet behavior remain intact.

## Out of scope

- Adding a second onboarding step to customize menu names.
- Changing prices, ingredients, dishes, recipes or menu composition in the seven packages.
- Automatically adding VIP menus to every restaurant.
- Refactoring the cuisine-template definition DSL.
- Changing restaurant permissions, publication state or setup status.
- Adding routes, dependencies, a component library or a new template persistence model.

## Validation plan

- `cd cohan-restaurant-backend && npx vitest run tests/services/restaurant-cuisine-template.service.test.js`
- `npx vitest run src/components/Dashboard_Manager/RestaurantSetup/RestaurantCuisineOnboarding.test.jsx`
- `npm run check:graphql`
- `npm run build`
- Manual dialog review at 390x844, 768px and 1440px when browser runtime is available.
