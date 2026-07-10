# Cuisine template preview upgrade

## Current behavior and root cause

The new-restaurant onboarding dialog renders flat radio cards from `restaurantCuisineTemplates`. The GraphQL summary only exposes counts plus four `featuredItems`, so the client cannot show the complete list of dishes that will actually be created. The summary also omits the recipe count even though the template package creates one recipe per starter dish.

## End-to-end flow

`Restaurant.initialSetup.status = pending` → `Header` mounts `RestaurantCuisineOnboarding` → Apollo queries `restaurantCuisineTemplates` → resolver returns `listCuisineTemplates()` → `listRestaurantCuisineTemplateSummaries()` strips template sections → the selected template is applied through `applyRestaurantCuisineTemplate` and the snapshot importer.

## Direction

Warm restaurant starter selector using the existing onboarding palette, compact operational counts, and native progressive disclosure for the complete dish list.

## Scope

- Add `recipeCount` and the full ordered `dishNames` list to template summaries.
- Add those fields to the GraphQL schema and frontend query.
- Show exactly three representative metrics on every template: dishes, ingredients, recipes.
- Add an accessible expandable control with a directional arrow and the full dish list.
- Preserve selection, apply, skip, permissions, restaurant scoping, snapshot import, and first-run visibility behavior.
- Keep the expanded content responsive and keyboard operable without adding dependencies.

## Acceptance criteria

1. Every template card shows dish, ingredient, and recipe counts from backend data.
2. Every template exposes all dishes that will be created, not only the four featured items.
3. The disclosure is a native keyboard-operable control with visible focus and an accessible label.
4. Opening dish details does not change the selected template or trigger setup.
5. Existing apply and skip mutations remain unchanged.
6. Backend and component tests cover the new contract and disclosure behavior.

## Out of scope

- Editing dishes, ingredients, prices, or recipes inside onboarding.
- Changing template contents or adding new cuisine packages.
- Changing permissions, initial setup state, snapshot import behavior, or publication status.
- Adding a new component library, icon package, animation library, or backend endpoint.

## Validation plan

- `npm --prefix cohan-restaurant-backend test -- tests/services/restaurant-cuisine-template.service.test.js`
- `npx vitest run src/components/Dashboard_Manager/RestaurantSetup/RestaurantCuisineOnboarding.test.jsx`
- `npm run check:graphql`
- `npm run check:conflicts`
- `npm run build`
