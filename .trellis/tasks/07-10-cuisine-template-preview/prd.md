# Cuisine template preview upgrade

## Current behavior and root cause

The new-restaurant onboarding dialog renders template cards from `restaurantCuisineTemplates`. The GraphQL summary previously exposed only counts plus four `featuredItems`, so the client could not show the complete list of dishes or the recipe count.

After the preview upgrade, another reachability gap remained: clicking **X**, **Để sau**, or pressing Escape only set the onboarding component's local `dismissed` state. While the restaurant stayed `initialSetup.status = pending`, no persistent UI action existed to clear that state. Users could only recover by refreshing the page or switching restaurants.

## End-to-end flow

`Restaurant.initialSetup.status = pending` → `Header` mounts `RestaurantCuisineOnboarding` → Apollo queries `restaurantCuisineTemplates` → resolver returns `listCuisineTemplates()` → the selected template is applied through `applyRestaurantCuisineTemplate` and the snapshot importer.

For reopening: `Header` keeps the pending restaurant in scope → account-menu action increments `openRequest` → `RestaurantCuisineOnboarding` clears only its dismissed/error UI state → existing query, selection, permission, apply, and skip paths continue unchanged.

## Direction

Warm restaurant starter selector using the existing onboarding palette, compact operational counts, native progressive disclosure, and one persistent recovery action in the existing account menu.

## Scope

- Keep `recipeCount` and the full ordered `dishNames` list in template summaries.
- Show dishes, ingredients, and recipes on every template card.
- Keep the accessible expandable control with the full dish list.
- Add **Chọn mẫu thiết lập nhà hàng** to the existing manager account menu while the selected branch is still pending setup.
- Reopen a dismissed dialog without refreshing, changing restaurant scope, or triggering a mutation.
- Preserve selection, apply, skip, permissions, restaurant scoping, snapshot import, and publication state.
- Do not add styles, dependencies, routes, backend endpoints, or duplicated setup state.

## Acceptance criteria

1. Every template card shows dish, ingredient, and recipe counts from backend data.
2. Every template exposes all dishes that will be created.
3. Opening dish details does not change the selected template or trigger setup.
4. Dismissing the picker leaves a persistent reopen action in the account menu while setup is pending.
5. Activating the reopen action restores the same onboarding dialog without reload or restaurant switching.
6. The reopen action disappears when the restaurant is no longer pending or the user is a system admin.
7. Existing apply and skip mutations remain unchanged.
8. Header and onboarding component tests cover the reopen signal.

## Out of scope

- Editing dishes, ingredients, prices, or recipes inside onboarding.
- Changing template contents or adding new cuisine packages.
- Changing permissions, initial setup state, snapshot import behavior, or publication status.
- Adding a dedicated settings page, new component library, icon package, animation library, or backend endpoint.

## Validation plan

- `npx vitest run src/components/Dashboard_Manager/Header.test.jsx src/components/Dashboard_Manager/RestaurantSetup/RestaurantCuisineOnboarding.test.jsx`
- `npm run check:conflicts`
- `npm run build`
- Standard frontend and backend CI.
