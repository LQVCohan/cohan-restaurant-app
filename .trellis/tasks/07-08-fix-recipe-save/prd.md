# Fix recipe save action

## Current behavior

The recipe modal opens and the submit button is enabled, but saving an existing recipe does not complete. The form submit handler runs, then the mutation path rejects the payload before GraphQL is called.

## Root cause

`RecipeModal` serializes the edited variants under `variants`, while the existing frontend hook, GraphQL input, resolver, and Mongoose model all use `servingVariants`. `useRecipes.buildUpsertInput` therefore receives no variants and rejects the operation with `servingVariants phải có ít nhất 1 biến thể.`

## End-to-end flow

1. `recipe.model.js` stores `servingVariants`.
2. `UpsertRecipeInput` exposes `servingVariants`.
3. `upsertRecipe` normalizes and saves `input.servingVariants`.
4. `useRecipes` builds the mutation input from `form.servingVariants`.
5. `RecipeList.handleSave` receives the modal payload and forwards it to `useRecipes`.
6. `RecipeModal` currently emits the same data under the legacy key `variants`.

## Scope

- Normalize the modal payload at the immediate caller boundary before forwarding it to add/update handlers.
- Preserve compatibility with payloads that already contain `servingVariants`.
- Keep the existing schema, resolver, GraphQL operation, permission checks, optimistic update, and refetch behavior unchanged.

## Files to change

- `src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx`: map `variants` to `servingVariants` in `handleSave` before invoking the existing handlers.
- `.trellis/tasks/07-08-fix-recipe-save/task.json`: track the bug fix.
- `.trellis/tasks/07-08-fix-recipe-save/prd.md`: record the flow, root cause, scope, and validation.

## Acceptance criteria

- Clicking **Lưu công thức** forwards a payload containing `servingVariants`.
- Existing payloads already using `servingVariants` continue to work.
- Add and update recipe paths both use the normalized payload.
- No schema, resolver, model, GraphQL document, dependency, permission, or styling change is introduced.

## Out of scope

- Redesigning the modal.
- Changing recipe validation rules.
- Changing backend persistence or authorization.
- Adding new abstractions or dependencies.

## Validation plan

- Run the targeted `RecipeList` Vitest file if the repository runtime is available.
- Run the narrow GraphQL contract check if available.
- Re-fetch the changed file and verify the save handler forwards `servingVariants` on both add and update paths.
- Review the diff for unrelated changes.
