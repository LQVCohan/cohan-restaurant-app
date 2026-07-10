# Compact manager menu item cards

## Current behavior

- The dish photo is constrained to a shallow frame by the compact-card override, so the crop looks like a thin banner instead of a food preview.
- A card repeats secondary information: stock note, full preparation-station panel, completed For You readiness, warning, one-variant price table, and four large action buttons.
- The base price is already shown beside the dish name, so a one/default-variant table adds height without adding information.

## Root cause

The compact grid stylesheet still follows the older information-heavy card layout. The existing React component already exposes enough semantic classes to simplify the presentation without changing data flow or adding another component.

## Flow

- `useMenuManagement` provides each `MenuItem`, including image, status, inventory data, prep station, and serving variants.
- `MenuManagement.jsx` maps filtered items to `MenuItemCard`.
- `MenuItemCard.jsx` retains all current actions and data.
- `MenuManagementCardCompactFix.scss` is loaded after the older manager-card rules and owns the final grid layout.
- `PrepStationControl.module.scss` owns the editable preparation-station control.

## Files and changes

- `MenuManagementCardCompactFix.scss`: use a stable 16:9 cover frame, tighten content, hide completed recommendation badges and redundant one-variant tables, compact warning strips, and place actions in one row.
- `PrepStationControl.module.scss`: remove the nested panel appearance and keep the existing select as a compact inline control.

## Acceptance criteria

- Dish photos fill a stable frame without stretching or appearing as a shallow banner.
- The card keeps dish name, price, selling/stock state, prep station, missing-data warning, useful multi-variant information, and all existing actions.
- The “Đã đủ thông tin tư vấn” badge and one/default-variant mini table no longer consume grid-card space.
- Desktop actions fit one compact row; tablet and mobile switch to three, two, and one columns without CSS zoom.
- No GraphQL, mutation, permission, status, inventory, recipe, or customer-facing behavior changes.

## Out of scope

- Changing uploaded image files or implementing focal-point editing.
- Changing customer-facing menu cards.
- Replacing the existing card, modal, icon, or styling stack.
