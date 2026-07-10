# Fix recipe list staying empty after returning to the tab

## Current behavior

- The recipe query succeeds in Network, but the recipe tab can still show an empty state until the whole page is reloaded.
- The issue is intermittent and is most visible after leaving the recipe tab and returning to it.

## Root cause

`useRecipes` keeps a local `recipes` state derived from Apollo `listState.data`. Leaving the recipe tab passes a null restaurant id and clears the local state, while Apollo retains the previous query result. When the same cached data object is reused on the next fetch, the effect watching only `listState.data` may not run again, so the UI remains empty even though the request succeeds. Concurrent list requests can also complete out of order and overwrite a newer result.

## Flow traced

`Menu/MenuItem/Recipe models -> menuItemsWithRecipes resolver -> Q_MENU_ITEMS_WITH_RECIPES_PAGED -> useRecipes -> StorageManagement tab switch -> RecipeList empty/loading state`.

## Files

- `src/hooks/useRecipes.js`: apply each fetch result directly to local list state and ignore stale request completions.
- `src/hooks/useRecipes.test.jsx`: reproduce leaving and returning to the recipe tab with the same Apollo data object.

## Acceptance criteria

- Returning to the recipe tab restores the fetched rows without reloading the page.
- A successful list request always updates `recipes`, `pageInfo`, and `total`, even when Apollo reuses the same cached data object.
- An older request cannot overwrite the result of a newer request.
- No GraphQL schema, resolver, permissions, or recipe persistence changes.

## Validation

- Run `vitest run src/hooks/useRecipes.test.jsx` when an executable checkout is available.
- Review the schema-to-resolver-to-hook-to-tab flow.

## Out of scope

- Redesigning the recipe UI.
- Changing recipe search, pagination, or backend query behavior.
- Adding dependencies.
