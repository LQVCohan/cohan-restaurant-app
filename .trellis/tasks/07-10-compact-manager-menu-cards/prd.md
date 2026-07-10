# Compact manager menu item cards

## Current behavior

- The dish image is styled in several files; the last override uses `object-fit: contain` with inner padding, which shrinks photos and exposes an artificial background.
- A card repeats secondary information: image status badge, stock note, full preparation-station panel, For You readiness, warning, variant table, and four large action buttons.
- A single serving variant still renders a full mini table even though its price is already shown beside the dish name.

## Root cause

The card accumulated page-level override layers instead of keeping the compact grid rules in the existing `MenuManagementCardCompactFix.scss`. Content hierarchy was never reduced after new inventory and recommendation states were added.

## Flow

- `useMenuManagement` provides each `MenuItem`, including image, status, inventory data, prep station, and serving variants.
- `MenuManagement.jsx` maps the filtered items to `MenuItemCard`.
- `MenuItemCard.jsx` chooses which operational details and actions to render.
- `MenuItemCard.scss`, `MenuManagementManagerFixes.scss`, `MenuManagementCardCompactFix.scss`, and `MenuManagementPolish.scss` currently participate in the final card appearance.

## Files and changes

- `MenuItemCard.jsx`: remove redundant ready-state copy, show variants only when useful, cap the preview at two variants, and reduce action labels.
- `PrepStationControl.module.scss`: make the existing control an inline compact row without changing its mutation behavior.
- `MenuManagementCardCompactFix.scss`: own the final grid-card image, body, variants, action, and responsive layout.
- `MenuManagementPolish.scss`: delete the later duplicate image override so it no longer fights the compact-card stylesheet.

## Acceptance criteria

- Dish photos fill a stable, attractive frame without stretching or the padded `contain` effect.
- The card keeps dish name, price, selling/stock state, prep station, missing-data warning, useful variants, and all existing actions.
- The “Đã đủ thông tin tư vấn” badge and one-variant mini table no longer consume space.
- Desktop actions fit one compact row; tablet and mobile remain usable with visible focus states.
- No GraphQL, mutation, permission, status, inventory, or recipe behavior changes.

## Out of scope

- Changing uploaded image files or implementing image focal-point editing.
- Changing customer-facing menu cards.
- Replacing the existing card, modal, icon, or styling stack.
