# Menu item serving mode selector

## Current behavior

The manager menu item modal stored `mode`, `sellQty`, and `sellUnit` for each preparation method, but the right-hand preparation section only rendered name, price, and cooking time. Managers therefore could not choose whether a serving variant was sold by portion or by weight.

## Root cause

The persistence contract was already complete. `Recipe.servingVariants` supports independent `PORTION` and `BY_WEIGHT` entries, the GraphQL input exposes those fields, the resolver normalizes them, and `useRecipes` forwards them. The missing boundary was the modal UI: it kept the fields in state but never exposed a control that updated them.

## End-to-end flow

1. `recipe.model.js` stores multiple `servingVariants`, each with `mode`, `sellQty`, `sellUnit`, `price`, and ingredients.
2. `ServingVariantInput` accepts `PORTION` or `BY_WEIGHT` with `portion`, `g`, or `kg` sell units.
3. `upsertRecipe` normalizes portion variants to `sellQty=1/sellUnit=portion` and weighted variants to a valid weight unit.
4. `useRecipes` preserves the same contract through the Apollo mutation and optimistic state.
5. `MenuItemModal.buildRecipeForm` serializes those fields.
6. The modal now exposes the serving mode in each preparation card.
7. Order/customer flows already read multiple serving variants and distinguish kg quantities from portion quantities.

## Visual direction

Reuse the modal's existing compact native select and form styles so the new control remains consistent, keyboard-operable, and responsive without adding another style layer.

## Implemented scope

- Added a native **Kiểu tính giá** selector to every preparation method with **Theo phần** and **Theo kg**.
- Kept each method independent so one menu item can contain both portion and weight variants.
- Normalized mode changes to canonical persisted values:
  - `PORTION` -> `sellQty=1`, `sellUnit=portion`
  - `BY_WEIGHT` -> `sellQty=1`, `sellUnit=kg`
- Made the price label reflect the selected unit.
- Preserved recipe ingredients, default variant selection, permissions, restaurant scope, and save/refetch behavior.
- Added focused source-contract coverage.

## Files changed

- `src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx`: exposes and normalizes serving mode per preparation method.
- `src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.foodClassification.test.jsx`: asserts both modes and canonical payload fields remain present.
- `.trellis/tasks/07-10-menu-serving-mode/task.json`: tracks task state.
- `.trellis/tasks/07-10-menu-serving-mode/prd.md`: records flow, scope, implementation, and validation.

## Acceptance criteria

- Each preparation card visibly offers **Theo phần** and **Theo kg**.
- Selecting **Theo phần** submits `mode=PORTION`, `sellQty=1`, and `sellUnit=portion`.
- Selecting **Theo kg** submits `mode=BY_WEIGHT`, `sellQty=1`, and `sellUnit=kg`.
- Different preparation cards can use different modes in the same menu item.
- Editing an existing weighted variant displays **Theo kg** selected.
- The price field clearly indicates whether the value is per portion or per kilogram.
- The selector is keyboard-operable, has a visible label, and uses the existing responsive form layout.
- No backend model, GraphQL, resolver, dependency, permission, or realtime change is introduced.

## Out of scope

- Supporting arbitrary selling units beyond the requested portion and kilogram choices in this modal.
- Redesigning recipe ingredient entry.
- Changing order pricing, inventory consumption, or public menu selection flows.
- Adding a new component abstraction or dependency.

## Validation result

- Re-fetched the changed source and test files from `main` after each write.
- Reviewed commit `d6ce577ab683f41bbf18163a7dbec1c33b4cc687`; the functional diff is limited to serving-mode constants, normalization, edit-state mapping, the per-method selector, and unit-aware price label.
- Reviewed the focused source-contract assertions added in commit `006e354786c78f49b26400b1ff8bab91710d468c`.
- No GitHub Actions workflow was attached to the test commit.
- Vitest, GraphQL checks, and the frontend build were not executed because this connector session does not expose an executable repository checkout.
