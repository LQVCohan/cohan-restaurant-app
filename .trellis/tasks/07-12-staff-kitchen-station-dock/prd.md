# Staff kitchen station dock

## Current behavior and root cause

`/staff/kitchen` already supports Bếp chính, Quầy bar and Tổng hợp correctly, including role locking, live counts and item filtering. The current switcher presents each mode as a large descriptive card, so the control consumes too much vertical space and does not read like the compact station control already used by Order Management.

The root cause is presentation-only. The existing React component already renders native buttons with stable labels, counts and mode state; changing GraphQL, hooks or status logic would duplicate working behavior.

## End-to-end flow

`OrderItem.station` and kitchen work-item metadata -> `ordersByRestaurantNow` -> `useOrderManagement` -> `StaffKitchenPage` station/count/status filtering -> station button -> item action -> `updateOrderItemStatus`.

No schema, resolver, permission, restaurant scope, realtime listener, station assignment or item transition changes are required.

## Direction

A compact light station dock inspired by Order Management, but not copied: warm neutral shell, sage kitchen mode, cool blue bar mode, strong active state, visible counts and a phone-safe horizontal rail.

## Scope

- Restyle the existing `staff-kitchen-page__mode-switcher` as a compact segmented station dock.
- Keep all three existing labels, descriptions, counts and click behavior.
- Use the existing kitchen/bar CSS variables and warm neutral surfaces.
- Give kitchen, bar and combined modes distinct active treatments without relying on color alone.
- Preserve the single locked-mode layout for chef/bartender roles.
- Keep touch targets at least 44px and retain visible keyboard focus.
- Keep phone layouts horizontally scrollable without oversized cards or content overlap.

## Acceptance criteria

1. Bếp chính, Quầy bar and Tổng hợp appear as compact mode buttons with their live counts.
2. The active mode is obvious through fill, border, elevation and text treatment.
3. The control uses a different light template and palette from Order Management's dark focus mode.
4. The switcher consumes materially less height than the current three-card layout.
5. Locked staff roles still see only their assigned station cleanly.
6. 390x844 and 430x932 layouts remain usable without page-level horizontal overflow.
7. Existing queue filtering, counts, actions, loading, error and empty states remain unchanged.

## Files

- `src/styles/StaffKitchenCompactHeader.css`: scoped visual override only.

## Out of scope

- GraphQL/schema/resolver/hook changes.
- Changes to station routing, role locking or order-item status transitions.
- New component libraries, dependencies, icons or duplicate station-switcher components.

## Validation plan

- `npx vitest run src/components/Staff/StaffKitchenPage.test.jsx`
- `npm run check:staff-theme`
- `npm run build`
- Manual responsive review at 390x844, 430x932, 768px, 1024px and 1440px when a browser runtime is available.
