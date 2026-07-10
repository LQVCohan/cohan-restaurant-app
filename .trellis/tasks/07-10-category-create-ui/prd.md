# Category creation contract and manager UI

## Current behavior

The manager category form sends `isActive` for both create and update. The GraphQL update input supports it, but `CreateCategoryInput` does not, so GraphQL rejects category creation before the resolver runs. The modal also uses a long single-column form, exposes limited status context, and lacks accessible names on several icon-only actions.

## Root cause

The Mongoose model contains `isActive` and the create resolver writes the field, but the GraphQL create input omitted it and the resolver hard-coded new categories to active. This creates contract drift between model, schema, resolver, Apollo payload, and UI.

## End-to-end flow

1. `Category` model stores `isActive` with a default of `true`.
2. `CreateCategoryInput` validates the modal payload at the GraphQL boundary.
3. `CategoryMutation.createCategory` checks restaurant scope and menu-category permission, then upserts the normalized category.
4. `useCategoryManagement.createCategory` submits the modal payload and refetches category queries.
5. `DishCategoryModal` lets a manager set name, icon, display order, and visibility.
6. The resolver test verifies that an explicit inactive create value reaches `$setOnInsert`.

## Scope

- Add `isActive` to the category create GraphQL contract.
- Preserve explicit inactive state while keeping active as the default.
- Improve the existing modal hierarchy, responsive layout, status feedback, empty/loading/error states, and accessibility.
- Keep existing permission, refetch, draft, delete protection, and dependency behavior.

## Files to change

- `cohan-restaurant-backend/graphql/schema/category.graphql`: align the create input.
- `cohan-restaurant-backend/graphql/resolvers/category/mutation.js`: honor the create state.
- `cohan-restaurant-backend/tests/resolvers/category-modifier-restaurant-access.test.js`: add the narrow resolver regression check.
- `src/components/Dashboard_Manager/Menu/components/DishCategoryModal/DishCategoryModal.jsx`: improve labels, states, copy, and structure.
- `src/components/Dashboard_Manager/Menu/components/DishCategoryModal/DishCategoryModalPolish.scss`: add the responsive two-column form, focus states, switch styling, and reduced-motion handling.

## Acceptance criteria

- Creating a category with `isActive: true` or `false` passes GraphQL validation.
- Omitting `isActive` still creates an active category.
- Restaurant scoping and `MANAGE_CATEGORY` permission checks remain unchanged.
- The form exposes name, icon, display position, and visibility with clear helper/error text.
- List rows show whether a category is visible or hidden.
- Icon-only controls have accessible names and visible keyboard focus.
- Desktop uses the available modal width; mobile stacks controls without hiding actions.
- No new package or abstraction is added.

## Out of scope

- Changing category uniqueness, time-slot storage, menu-item/category relationships, or delete rules.
- Reworking Apollo cache policy or notification infrastructure.
- Redesigning other menu modals.
- Adding new dependencies.

## Validation plan

- Run `npm run check:graphql`.
- Run the targeted category resolver test.
- Run the frontend component test suite or the narrowest modal test available.
- Run `npm run build`.
- Review desktop and mobile modal states when a browser preview is available.
