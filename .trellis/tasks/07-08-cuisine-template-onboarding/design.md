# Design

## End-to-end flow

1. `Restaurant` persistence stores an optional `initialSetup` subdocument.
2. A schema pre-validation hook initializes only new brand restaurants to `pending` and `draft`; legacy documents stay without the field.
3. `Restaurant.initialSetup` and template metadata are exposed through GraphQL.
4. A dedicated resolver checks restaurant scope and `restaurant.write`, then calls the template service.
5. The service converts the selected versioned template into the existing configuration snapshot shape and calls `importRestaurantConfigSnapshot` for `restaurantProfile`, `menuCatalog` and `inventoryMaster`.
6. Only after a successful import does it write `completed`, template key/version, actor and timestamp.
7. `useBrandManagement` fetches `initialSetup` for brand restaurants.
8. The always-mounted manager header resolves the selected restaurant from the existing scope selection event and renders the onboarding modal when status is `pending`.
9. The modal refetches `MY_BRANDS_QUERY` after apply/skip, removing itself without a page reload.

## Data strategy

Templates are static source-controlled data, not MongoDB records. Stable `legacyId` values connect menus, categories, menu items, ingredients and recipes. The existing snapshot importer remaps those references to target restaurant ObjectIds.

Each package uses exactly 10 ingredients and a small number of dishes. Costs and stock levels remain zero because they cannot be inferred safely.

## Permission strategy

The mutation requires:

- authenticated user;
- `restaurant.write` permission;
- system-admin access, brand-management access, or restaurant scope access.

No new permission or dependency is introduced.

## Failure behavior

The restaurant remains `pending` when import fails. The importer uses keyed upserts, so a retry completes missing records rather than blindly duplicating them. Completed or skipped setup cannot be run again.

## UI direction

A warm cream onboarding dialog matches the existing orange/cream manager shell. Cuisine options use native radio inputs inside selectable cards, plain Vietnamese copy, explicit counts, visible focus, Escape close and a separate “Tự thiết lập” action.
