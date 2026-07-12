# Restaurant template menu structure preview

## Current behavior and root cause

The new-restaurant template picker shows cuisine, dish, ingredient and recipe counts, then exposes one flat dish list. It does not show which menus will be created or how dishes are assigned to the four service time slots.

The deeper contract still uses `timeSlot` as the menu identity inside `restaurantCuisineTemplates.js`: menu IDs are stored in `Map<timeSlot, id>` and dishes resolve their menu only by `timeSlot`. This prevents a future template from containing two named menus in the same slot even though the main Menu domain now supports it.

## End-to-end flow

`restaurantCuisineTemplates definitions` -> `buildTemplate()` creates snapshot menu/item references -> `listCuisineTemplates()` returns preview summaries -> `RestaurantInitialSetupQuery.restaurantCuisineTemplates` -> GraphQL `RestaurantCuisineTemplate` -> Apollo query in `RestaurantCuisineOnboarding` -> manager selects and applies the unchanged template mutation -> snapshot importer creates menus by `(timeSlot, name)`.

## Direction

Warm, compact starter-template picker that previews operational menu structure first: named menus grouped by service time, exact dish allocation, and one clear apply action. The page remains a cuisine selector, not a menu editor.

## Scope

1. Treat a template menu's unique `key` as its identity; keep `timeSlot` as classification only.
2. Allow a dish definition to target `menuKey`, defaulting to its current `timeSlot` for existing packages.
3. Return a structured menu preview for every template: menu key, name, time slot, dish count and dish names.
4. Return the number of distinct service time slots.
5. Show menu count in the card metrics.
6. Replace the flat dish disclosure with menus grouped by the four service slots.
7. Explain that managers may create additional VIP, formal or casual menus in the same slot after setup.
8. Preserve the apply/skip mutation, permissions, pending state, snapshot contents and existing seven packages.

## Acceptance criteria

1. Existing seven cuisine packages still build and import with the same menu, item, recipe and ingredient counts.
2. Template generation no longer maps menu identity by `timeSlot`.
3. GraphQL summaries expose every menu and its exact dishes.
4. A summary supports two menus sharing one time slot without collapsing either menu.
5. Every card displays menu, dish, ingredient and recipe counts.
6. The native disclosure shows menu names, service-slot labels and dishes assigned to each menu.
7. Empty menu previews fall back to the existing flat dish list instead of rendering broken content.
8. Selecting, dismissing, reopening, applying and skipping continue to work unchanged.
9. Keyboard focus, native radio/`details`, visible focus, loading/error states and mobile bottom-sheet behavior remain intact.

## Out of scope

- Adding a second onboarding step to customize menu names.
- Changing prices, ingredients, dishes or recipes in the seven packages.
- Automatically adding VIP menus to every restaurant.
- Changing restaurant permissions, publication state or setup status.
- Adding routes, dependencies, a component library or a new template persistence model.

## Validation plan

- `cd cohan-restaurant-backend && npx vitest run tests/services/restaurant-cuisine-template.service.test.js`
- `npx vitest run src/components/Dashboard_Manager/RestaurantSetup/RestaurantCuisineOnboarding.test.jsx`
- `npm run check:graphql`
- `npm run build`
- Manual dialog review at 390x844, 768px and 1440px when browser runtime is available.
