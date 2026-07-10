# Fix recipe values displayed after save

## Current behavior

Recipe cards and the detail modal can show `Chưa phân loại`, `Nguyên liệu không xác định`, `Thiếu cost`, and zero cost even though the recipe form contains category, ingredient, quantity, waste, and ingredient cost data.

## Root cause

The recipe UI computes display values from recipe-line snapshots that may not contain hydrated ingredient metadata, especially immediately after optimistic save. The detail modal also ignores the GraphQL `name` field, the card reads `category` although list rows carry `categoryId`, and list cost calculation omits waste percentage.

## Flow traced

`Ingredient/Recipe models -> RecipeIngredientLine type resolvers -> recipe GraphQL fragments -> useRecipes normalization/optimistic state -> RecipeList meta -> RecipeCard/RecipeDetailModal`.

## Scope

- Enrich recipe lines from the already-loaded ingredient list before calculating or rendering.
- Preserve the smallest shared UI contract without adding a new query or dependency.
- Read all supported ingredient name, unit, and cost fields.
- Make card and modal cost calculations use the same waste formula.
- Show a category label when `categoryId` exists instead of falsely reporting unclassified.

## Files

- `src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx`
- `src/components/Dashboard_Manager/Storage/components/recipes/RecipeCard.jsx`
- `src/components/Dashboard_Manager/Storage/components/recipes/RecipeDetailModal.jsx`
- focused recipe component tests if current fixtures support the path

## Acceptance criteria

- Ingredient names render from the selected ingredient after save and reload.
- Unit cost and line/variant minimum cost render from ingredient cost.
- Waste percentage affects list and detail cost consistently.
- A recipe with `categoryId` is not labeled `Chưa phân loại`.
- Missing/deleted ingredient detection remains unchanged.

## Out of scope

- Changing recipe or ingredient persistence schemas.
- Adding new dependencies or redesigning the recipe screen.
