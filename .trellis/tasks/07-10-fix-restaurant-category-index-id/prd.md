# Fix RestaurantCategoryIndex GraphQL id

## Current behavior

On the restaurant information management screen, clicking **Cập nhật danh mục** successfully reaches `updateRestaurantCategoryIndex`, but the GraphQL response fails with `Cannot return null for non-nullable field RestaurantCategoryIndex.id`.

## Root cause

`RestaurantCategoryIndex` inherits the virtual `id` field from `BaseSchemaModel`, but both the update mutation and index query return plain objects from `.lean()`. Lean results contain `_id` and do not reliably expose the virtual `id`. The GraphQL schema declares `RestaurantCategoryIndex.id` as non-null and the restaurant type resolver currently maps `_id` only for `Restaurant`, not for `RestaurantCategoryIndex`.

The smallest shared correction is to add a `RestaurantCategoryIndex.id` field resolver that returns the existing `id` when present and otherwise stringifies `_id`. This fixes every current lean caller without changing persistence, authorization, mutation behavior, or frontend state.

## End-to-end flow

1. `restaurant-category-index.model.js` stores MongoDB `_id` and defines a virtual `id` through `BaseSchemaModel`.
2. `restaurant.graphql` declares `RestaurantCategoryIndex.id: ID!`.
3. `updateRestaurantCategoryIndex` upserts the index and returns `.lean()`; `restaurantCategoryIndexes` also returns `.lean()` rows.
4. `RestaurantInfoManagement.jsx` calls `UPDATE_INDEX` from the **Cập nhật danh mục** button and requests `id` in the mutation result.
5. GraphQL default field resolution sees no `id` property on the lean row and raises the non-null error.
6. The restaurant type resolver is the shared boundary where `_id` should be mapped to `id`.

## Scope

- Add the missing GraphQL field resolver for `RestaurantCategoryIndex.id`.
- Add one focused resolver test covering lean rows with only `_id` and rows already containing `id`.

## Files to change

- `cohan-restaurant-backend/graphql/resolvers/restaurant/types.js`: add the shared `RestaurantCategoryIndex.id` mapping.
- `cohan-restaurant-backend/tests/resolvers/restaurant-category-index-types.test.js`: protect the GraphQL contract regression.
- `.trellis/tasks/07-10-fix-restaurant-category-index-id/task.json`: record completion after verification.

## Acceptance criteria

- Category index mutation responses return a non-null string `id` when the database result contains `_id`.
- Existing objects that already expose `id` keep that value.
- Restaurant scope checks, permission checks, category data, counts, and UI behavior remain unchanged.
- No frontend workaround, schema relaxation, dependency, or database migration is introduced.

## Out of scope

- Redesigning the restaurant information page.
- Changing category synchronization semantics or menu item counts.
- Replacing `.lean()` across unrelated restaurant queries.
- Modifying permissions, audit logging, realtime behavior, or persistence indexes.

## Validation plan

- Run the focused Vitest file for `RestaurantCategoryIndex` type resolution.
- Run the existing restaurant mutation access test to ensure the update path and authorization remain intact.
- Run the repository GraphQL contract check if available.
- Review the diff for unintended schema, UI, or authorization changes.
