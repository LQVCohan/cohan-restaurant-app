# Menu card variants, audit history and ingredient Vietnamese labels

## Current behavior

- Ingredient modal exposes technical unit codes such as `unit` and `VND / unit` directly to managers.
- The compact menu card hides the preparation-method block when only one variant exists and previews up to three variants instead of the requested two.
- Saving the menu item modal always calls `updateMenuItem` before saving its recipe. The menu flow can request an update audit record even when tracked MenuItem fields are unchanged.
- Existing empty audit rows render as “Không có thay đổi cần hiển thị”, and several field values or actor roles remain technical or untranslated.

## Root cause and flow

1. `IngredientModal` stores backend unit codes directly as option text and suffix text.
2. `useMenuManagement` returns `servingVariants`; `MenuManagement` passes them to `MenuItemCard`; compact card CSS previously hid a one-row table and allowed three method rows.
3. `MenuItemModal.handleSubmit` calls `updateMenuItem`, then `useRecipes.updateRecipe`/`upsertRecipe`.
4. Audit creation had no shared no-op guard, so an `update` with identical `before` and `after` values could be persisted.
5. `AuditLogModal` displayed all returned rows and translated only a small field/value subset.

## Files and changes

- `IngredientModal.jsx`: map stored unit codes to Vietnamese labels for select options and suffixes only.
- `IngredientModal.test.jsx`: assert that `piece` remains the form value while the UI shows “Cái”.
- `MenuManagementCardCompactFix.scss`: keep one preparation method visible, show at most two rows, and replace additional rows with `…`.
- `AuditLogModal.jsx`: localize roles, fields and values, and omit legacy no-op rows from the timeline.
- `audit-log.model.js`: reject new no-op update audit payloads at the shared model boundary.
- `audit-log-noop.test.js`: prove identical updates are rejected while real status and price changes remain meaningful.

## Acceptance criteria

- Ingredient modal shows Vietnamese unit names while submitting the original backend codes.
- Every grid card shows up to two preparation methods; additional methods appear as `…`.
- A card with one method still shows that method.
- Saving recipe-only changes does not create a blank MenuItem audit entry.
- Existing blank audit entries are not shown; meaningful updates use Vietnamese labels.
- No GraphQL schema, recipe storage contract, permission, or customer-facing menu behavior changes.

## Out of scope

- Migrating or deleting historical audit documents from MongoDB.
- Renaming user-created ingredient categories.
- Changing recipe audit schema or adding a new recipe-history entity.
