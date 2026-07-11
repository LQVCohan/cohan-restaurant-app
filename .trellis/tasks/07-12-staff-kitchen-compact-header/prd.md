# Compact staff kitchen header

## Current behavior and root cause

The `/staff/kitchen` operational page uses a landing-page-sized hero. Long per-mode headings wrap to two lines, the hero has up to 32px padding, and the separate venue card adds height before the station switcher and queue metrics. This pushes the main kitchen actions below the fold even on desktop.

## End-to-end flow

`ordersByRestaurantNow` -> `useOrderManagement` -> `StaffKitchenPage` station/status filtering -> kitchen/bar action -> `updateOrderItemStatus`.

No schema, resolver, permission, restaurant scope, realtime listener, order filtering, or status transition needs to change.

## Direction

Compact operational header using the existing kitchen/bar palette: short mode title, one-line supporting copy, inline venue status, and reduced vertical spacing so queue controls appear earlier.

## Scope

- Shorten the visible title for kitchen, bar, and combined modes.
- Reduce hero padding, title size, subtitle spacing, radius, shadow, and venue-card footprint.
- Keep the desktop/tablet header in two columns until the mobile breakpoint.
- Preserve current station identity, restaurant name, live update status, semantics, focus behavior, and responsive containment.
- Update the focused component test for the new headings.

## Acceptance criteria

1. The combined header title is `Khu chế biến` and does not wrap at normal desktop widths.
2. Kitchen and bar modes use concise operational headings.
3. The hero is visibly shorter while retaining restaurant and live-update information.
4. The station switcher and summary appear higher on the page without changing their behavior.
5. The layout remains contained at 390x844 and 430x932 without horizontal overflow.
6. Existing queue counts, filters, status actions, loading, error, and empty states remain unchanged.

## Out of scope

- Changing GraphQL, backend routing, item station assignment, permissions, or realtime behavior.
- Reworking the queue cards, metrics, filters, or action buttons.
- Adding icons, dependencies, a new component, or a second kitchen page.

## Validation plan

- `npx vitest run src/components/Staff/StaffKitchenPage.test.jsx`
- `npm run check:staff-theme`
- `npm run build`
- Manual review at 390x844, 430x932, 768px, 1024px and 1440px when a browser runtime is available.
