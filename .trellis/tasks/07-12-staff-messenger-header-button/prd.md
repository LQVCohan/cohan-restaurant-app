# Move staff messenger launcher into header

## Current behavior and root cause

`StaffLayout` exposes the same messenger modal through a `Liên lạc` navigation action and a fixed bottom-right launcher. The duplicated entry points add a non-page action to the workspace navigation and the floating button competes with page content. The header already owns the notification bell and account actions, so messaging belongs beside the bell.

## End-to-end flow

`ChatThread` model -> communication GraphQL resolver -> `useCommunication` -> `StaffLayout.openMessenger` -> `ContactsView` -> `ChatThreadPanel`.

`NotificationBell.onOpenThread` and the legacy `/staff/contacts` redirect already target the same `openMessenger` state and must remain unchanged.

## Direction

Compact staff header with notification and messenger as sibling icon actions; navigation contains only destinations.

## Scope

- Remove `/staff/contacts` from visible navigation groups and nav items.
- Add one accessible messenger icon button beside `NotificationBell` in the account action row.
- Remove the fixed bottom-right messenger launcher.
- Keep the modal open/close state, focused thread behavior, notification deep-links and legacy route compatibility.
- Match the bell's 44x44 target, sage hover/focus styling and mobile layout.
- Update the focused StaffLayout regression test.

## Acceptance criteria

1. Staff navigation no longer contains a `Liên lạc` option.
2. A messenger icon is shown beside the notification bell on normal staff pages.
3. The header messenger icon opens the existing `Tin nhắn nhân viên` modal without route navigation.
4. The fixed bottom-right launcher no longer renders.
5. Notification thread actions and `/staff/contacts?threadId=...` continue to open the same modal and focused thread.
6. The icon has an accessible name, `aria-expanded`, keyboard focus styling and at least a 44x44 target.
7. Header account actions do not overflow at phone widths.

## Out of scope

- Communication schema, resolvers, GraphQL operations, permissions or restaurant scoping.
- Redesigning `ContactsView` or `ChatThreadPanel`.
- Removing the compatibility `/staff/contacts` route.
- Adding unread message counts, calls, presence or a new realtime protocol.

## Validation plan

- `npx vitest run src/layouts/StaffLayout.test.jsx`
- `npm run check:conflicts`
- `npm run build`
- Manual review at 390x844, 430x932, 768px and 1440px when a browser runtime is available.
