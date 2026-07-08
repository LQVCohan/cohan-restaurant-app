# Cuisine template onboarding

## Current behavior

A brand owner/admin can create a restaurant branch with only `name` and `brandId`. The branch is immediately usable but has no starter menu, ingredients or recipes. Managers must configure every module manually.

## Goal

For newly created brand branches, show a first-run cuisine selector in the manager UI. Applying a template clones a small, editable starter profile, ingredients, menus, dishes and ingredient-linked recipes into that restaurant.

## Scope

- Cuisine templates: Vietnamese, Korean, Japanese, Italian, seafood, countryside Vietnamese and Thai.
- Each template contains 10 starter ingredients, meal-period menus, starter dishes and simple recipes.
- New brand branches are created as `publicationStatus: draft` with `initialSetup.status: pending`.
- Existing restaurants without `initialSetup` remain unchanged and do not receive the onboarding modal.
- Brand owner/admin, system admin and a manager scoped to the restaurant can apply or skip setup when they have restaurant write permission.
- Applying a template reuses the existing restaurant configuration snapshot importer so references are remapped consistently.

## Acceptance criteria

1. A newly created brand branch has `initialSetup.status = pending` and is not publicly published.
2. The manager header shows one accessible modal for the currently selected pending branch.
3. The modal lists seven cuisine templates with ingredient, menu and dish counts plus representative dishes.
4. Applying a template creates the profile defaults, exactly 10 ingredients, menus, categories, dishes and recipes with valid ingredient references.
5. The restaurant becomes `initialSetup.status = completed` only after import succeeds.
6. Skipping sets `initialSetup.status = skipped` without creating starter data.
7. Reapplying to a completed/skipped restaurant is rejected.
8. Existing restaurants with no `initialSetup` never show the modal.
9. The UI supports keyboard focus, Escape, loading and error feedback.

## Out of scope

- AI-generated templates at request time.
- Automatically publishing a branch after setup.
- Real opening hours, supplier data, stock quantities, ingredient costs, tax or deposit policies.
- A database CRUD interface for editing the global template definitions.
