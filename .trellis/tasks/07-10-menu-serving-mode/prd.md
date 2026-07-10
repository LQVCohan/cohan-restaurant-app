# Menu item serving mode selector

## Current behavior

The manager menu item modal stores `mode`, `sellQty`, and `sellUnit` for each preparation method, but the right-hand preparation section only renders name, price, and cooking time. Managers therefore cannot choose whether a serving variant is sold by portion or by weight.

## Root cause

The persistence contract is already complete. `Recipe.servingVariants` supports independent `PORTION` and `BY_WEIGHT` entries, the GraphQL input exposes those fields, the resolver normalizes them, and `useRecipes` forwards them. The missing boundary is the modal UI: it keeps the fields in state but never exposes a control that updates them.

## End-to-end flow

1. `recipe.model.js` stores multiple `servingVariants`, each with `mode`, `sellQty`, `sellUnit`, `price`, and ingredients.
2. `ServingVariantInput` accepts `PORTION` or `BY_WEIGHT` with `portion`, `g`, or `kg` sell units.
3. `upsertRecipe` normalizes portion variants to `sellQty=1/sellUnit=portion` and weighted variants to a valid weight unit.
4. `useRecipes` preserves the same contract through the Apollo mutation and optimistic state.
5. `MenuItemModal.buildRecipeForm` already serializes those fields.
6. The modal preparation card currently omits the serving mode control.
7. Order/customer flows already read multiple serving variants and distinguish kg quantities from portion quantities.

## Visual direction

Compact operational controls using the existing sage and warm-neutral modal surfaces, with one accessible two-choice selector inside each preparation card.

## Scope

- Add a native radio group to every preparation method for **Theo phần** and **Theo kg**.
- Keep each method independent so one menu item can contain both portion and weight variants.
- Normalize mode changes to the canonical persisted values:
  - `PORTION` -> `sellQty=1`, `sellUnit=portion`
  - `BY_WEIGHT` -> `sellQty=1`, `sellUnit=kg`
- Make the price label reflect the selected unit.
- Preserve existing recipe ingredients, default variant selection, permissions, restaurant scope, and save/refetch behavior.
- Add focused contract coverage.

## Files to change

- `src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx`: expose and normalize serving mode per preparation method.
- `src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModalPolish.scss`: style the selector and maintain responsive/touch behavior.
- `src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.foodClassification.test.jsx`: assert both modes and canonical payload fields remain present.
- `.trellis/tasks/07-10-menu-serving-mode/task.json`: track task state.
- `.trellis/tasks/07-10-menu-serving-mode/prd.md`: record flow, scope, and validation.

## Acceptance criteria

- Each preparation card visibly offers **Theo phần** and **Theo kg**.
- Selecting **Theo phần** submits `mode=PORTION`, `sellQty=1`, and `sellUnit=portion`.
- Selecting **Theo kg** submits `mode=BY_WEIGHT`, `sellQty=1`, and `sellUnit=kg`.
- Different preparation cards can use different modes in the same menu item.
- Editing an existing weighted variant displays **Theo kg** selected.
- The price field clearly indicates whether the value is per portion or per kilogram.
- Controls are keyboard-operable, have visible labels, and remain usable on mobile widths.
- No backend model, GraphQL, resolver, dependency, permission, or realtime change is introduced.

## Out of scope

- Supporting arbitrary selling units beyond the requested portion and kilogram choices in this modal.
- Redesigning recipe ingredient entry.
- Changing order pricing, inventory consumption, or public menu selection flows.
- Adding a new component abstraction or dependency.

## Validation plan

- Run `vitest run src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.foodClassification.test.jsx`.
- Run `npm run check:graphql` because the modal still submits the existing recipe contract.
- Run `npm run build` if the checkout runtime is available.
- Re-fetch changed files, inspect line ranges, and review the diff for contract drift or duplicated logic.
