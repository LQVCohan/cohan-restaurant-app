# Menu card variants, audit history and ingredient Vietnamese labels

## Current behavior

- Ingredient modal exposes technical unit codes such as `unit` and `VND / unit` directly to managers.
- The compact menu card hides the preparation-method block when only one variant exists and previews up to three variants instead of the requested two.
- Saving the menu item modal always calls `updateMenuItem` before saving its recipe. The menu mutation writes an update audit record even when tracked MenuItem fields are unchanged.
- Existing empty audit rows render as “Không có thay đổi cần hiển thị”, and several field values or actor roles remain technical or untranslated.

## Root cause and flow

1. `IngredientModal` stores backend unit codes directly as option text and suffix text.
2. `useMenuManagement` returns `servingVariants`; `MenuManagement` passes them to `MenuItemCard`; the card slices three variants while the compact SCSS hides a one-row table with `:has(...)`.
3. `MenuItemModal.handleSubmit` calls `updateMenuItem`, then `useRecipes.updateRecipe`/`upsertRecipe`.
4. `MenuMutation.updateMenuItem` always calls the shared `writeAuditLog`, regardless of whether `before` and `after` differ.
5. `AuditLogModal` displays all returned rows and only translates a small field/value subset.

## Files and changes

- `IngredientModal.jsx`: map stored unit codes to Vietnamese labels for select options and suffixes only.
- `MenuItemCard.jsx`: preview two variants and summarize the remainder with an ellipsis.
- `MenuManagementCardCompactFix.scss`: keep the preparation-method block visible for a single variant.
- `AuditLogModal.jsx`: localize roles/fields/values, render meaningful unknown updates generically, and omit legacy no-op rows.
- `menu/mutation.js`: skip update audit writes when the diff has no real change.
- `menu-audit-noop.test.js`: prove identical updates do not create audit rows while real changes do.

## Acceptance criteria

- Ingredient modal shows Vietnamese unit names while submitting the original backend codes.
- Every card shows up to two preparation methods; extra methods appear as `… +N cách khác`.
- A card with one method still shows that method.
- Saving recipe-only changes does not create a blank MenuItem audit entry.
- Existing blank audit entries are not shown; meaningful updates use Vietnamese labels.
- No GraphQL schema, recipe storage contract, permission, or customer-facing menu behavior changes.

## Out of scope

- Migrating or deleting historical audit documents from MongoDB.
- Renaming user-created ingredient categories.
- Changing recipe audit schema or adding a new recipe-history entity.
