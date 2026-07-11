# Compact staff kitchen header

## Current behavior and root cause

The `/staff/kitchen` operational page uses a landing-page-sized hero. Long per-mode headings wrap to two lines, the hero has up to 32px padding, and the separate venue card adds height before the station switcher and queue metrics. This pushes the main kitchen actions below the fold even on desktop.

## End-to-end flow

`ordersByRestaurantNow` -> `useOrderManagement` -> `StaffKitchenPage` station/status filtering -> kitchen/bar action -> `updateOrderItemStatus`.

No schema, resolver, permission, restaurant scope, realtime listener, order filtering, or status transition needs to change.

## Direction

Compact operational header using the existing kitchen/bar palette: smaller typography, tighter spacing, a compact venue status block, and reduced vertical depth so queue controls appear earlier.

## Scope

- Preserve the existing component structure and operational wording.
- Reduce hero padding, title size, subtitle spacing, radius, shadow, and venue-card footprint through a scoped style override.
- Remove the narrow title width that forced avoidable wrapping on desktop.
- Keep the desktop/tablet header in two columns until the phone breakpoint.
- Preserve current station identity, restaurant name, live update status, semantics, focus behavior, and responsive containment.

## Acceptance criteria

1. The existing per-mode heading receives more horizontal space and a smaller responsive type scale.
2. The hero is visibly shorter while retaining restaurant and live-update information.
3. The station switcher and summary appear higher on the page without changing their behavior.
4. Tablet widths retain a compact two-column header instead of prematurely stacking the venue card.
5. Phone widths stack safely without horizontal overflow at 390x844 and 430x932.
6. Existing queue counts, filters, status actions, loading, error, and empty states remain unchanged.

## Implementation

- `src/styles/StaffKitchenCompactHeader.css` contains only selectors scoped to `.staff-kitchen-page`.
- `src/main.jsx` loads the scoped override with the repository's existing global presentation styles.
- No React component, hook, test contract, GraphQL operation, or backend code changed.

## Out of scope

- Changing GraphQL, backend routing, item station assignment, permissions, or realtime behavior.
- Reworking the queue cards, metrics, filters, or action buttons.
- Changing the visible copy or adding icons, dependencies, a new component, or a second kitchen page.

## Validation plan

- `npx vitest run src/components/Staff/StaffKitchenPage.test.jsx`
- `npm run check:staff-theme`
- `npm run build`
- Manual review at 390x844, 430x932, 768px, 1024px and 1440px when a browser runtime is available.
