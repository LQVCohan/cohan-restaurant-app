# Fix recipe list staying empty after returning to the tab

## Current behavior

- The recipe query succeeds in Network, but the recipe tab can still show an empty state until the whole page is reloaded.
- The issue is intermittent and is most visible after leaving the recipe tab and returning to it.

## Root cause

`useRecipes` clears its local list when the recipe tab becomes inactive, while Apollo retains the previous `menuItemsWithRecipes` result. When the tab is opened again and the server returns data equivalent to the cached result, Apollo can preserve the result identity and the effect that copies `listState.data` into local state may not run again. The request therefore succeeds without restoring the rows in the UI.

## Flow traced

`Menu/MenuItem/Recipe models -> menuItemsWithRecipes resolver -> Q_MENU_ITEMS_WITH_RECIPES_PAGED -> Apollo cache -> useRecipes -> StorageManagement tab switch -> RecipeList empty/loading state`.

## Files

- `src/apollo/client.js`: add a field policy for `menuItemsWithRecipes` that preserves query-variable separation and returns a fresh connection result for each incoming response.

## Acceptance criteria

- Returning to the recipe tab restores the fetched rows without reloading the page.
- A successful `menuItemsWithRecipes` response produces a fresh result notification even when entity data is unchanged.
- Cache entries remain separated by restaurant and active recipe filters.
- No GraphQL schema, resolver, permissions, recipe persistence, or UI redesign changes.

## Validation

- Review the schema-to-resolver-to-query-to-cache-to-hook-to-tab flow.
- Run the focused recipe tab scenario and frontend tests when an executable checkout is available.

## Out of scope

- Redesigning the recipe UI.
- Changing recipe search, pagination, or backend query behavior.
- Adding dependencies.
