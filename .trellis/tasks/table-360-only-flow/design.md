# Design — table 360-only flow

## Product boundary

The table entity keeps its operational floor-map `position` and its supported visual content (`photos`, `vrUrl`). The application stops exposing the legacy model/AR `visualConfig` flow.

## Manager table list

Each table card has one visual action:

- configured: `Xem 360°` opens the table panorama route or external 360 URL;
- not configured: `Thêm ảnh 360°` opens the existing table detail modal where the manager can upload or paste a link.

The regular `Chi tiết` and operational status actions remain unchanged.

## Add-table modal

The modal becomes a focused quick-create form:

- concise header and context line;
- four operational fields in a two-column desktop grid;
- a small neutral guidance strip explaining that 360 content is added after creation from table details;
- one-column mobile layout with 44px controls;
- no model/template preview cards.

## Table detail modal

Keep the existing 360 workflow and remove only the dead 3D branches:

- no `visualConfig` helper imports;
- no camera preview modal;
- no saved-model summary or clear-model action;
- no state used solely for 3D camera preview.

## Customer floor map

A preview trigger appears only when `photos` or `vrUrl` exists. The dialog can show photos and an `Mở không gian 360°` link, but never a model URL or model label.

## Data contract

Remove `visualConfig` from the two client query fragments. Keep the GraphQL/Mongoose field for backward compatibility so existing records and older clients do not fail. No create/update payload in the active table-management flow will include it.

## Accessibility

- preserve native buttons and existing focus handling;
- use explicit 360 action labels per table code;
- keep modal labels, required markers and inline errors;
- avoid hiding essential form content on mobile.