# Staff kitchen focus mode

## Current behavior and root cause

`/staff/kitchen` can switch Bếp chính, Quầy bar and Tổng hợp, but those controls only filter the existing page. Unlike Order Management, staff cannot promote the operational board into a distraction-free, full-screen cooking display.

The data and action flow is already correct. The missing boundary is presentation state: there is no focus-mode owner that fixes the board to the viewport, locks background scrolling, provides an obvious exit route and compacts secondary content.

## End-to-end flow

`OrderItem.station` and timing metadata -> `ordersByRestaurantNow` -> `useOrderManagement` -> `StaffKitchenPage` station/status filtering -> kitchen/bar action -> `updateOrderItemStatus`.

Focus mode wraps this existing page only. It must not change schema, resolver, restaurant scoping, permission checks, socket updates or item-status transitions.

## Direction

A dark, high-contrast full-screen kitchen board following the existing Order Management focus interaction, while retaining the staff page's own station switcher, queue cards and kitchen/bar tones.

## Scope

- Add a route-level focus frame around the existing `StaffKitchenPage`.
- Add an explicit `Mở chế độ tập trung` action and a persistent full-screen exit action.
- Support `Escape` to leave focus mode.
- Lock and restore body scrolling safely while focus mode is active.
- Hide the normal hero and overview only in focus mode so station controls and actionable orders move to the top.
- Keep station switching, status filters, live counts, item actions, loading, error and empty states unchanged.
- Keep the focus header fixed while the kitchen queue scrolls.
- Use one-column cards on phone widths and larger readable cards on wider screens.

## Acceptance criteria

1. Staff can enter a fixed, viewport-sized focus mode from `/staff/kitchen`.
2. The staff header/navigation is visually covered without changing `StaffLayout` or route permissions.
3. The current Bếp chính, Quầy bar or Tổng hợp selection remains active when entering and leaving focus mode.
4. The existing station buttons and status filters remain usable in focus mode.
5. Staff can leave focus mode using the visible exit button or `Escape`.
6. Body overflow is restored after exit and component unmount.
7. Existing kitchen page tests remain valid, and the new focus boundary has a targeted component test.
8. 390x844 and 430x932 layouts have no page-level horizontal overflow or covered actions.

## Files

- `src/components/Staff/StaffKitchenFocusPage.jsx`: focus state, keyboard handling and scroll restoration.
- `src/components/Staff/StaffKitchenFocusPage.scss`: normal launcher and full-screen presentation.
- `src/components/Staff/StaffKitchenFocusPage.test.jsx`: focus enter/exit and cleanup coverage.
- `src/routes/AppRouter.jsx`: route the kitchen workspace through the focus frame.

## Out of scope

- New GraphQL fields, backend endpoints or mutations.
- Duplicating the kitchen queue or rewriting `StaffKitchenPage`.
- Browser Fullscreen API permission prompts.
- New dependencies or component libraries.

## Validation plan

- `npx vitest run src/components/Staff/StaffKitchenFocusPage.test.jsx src/components/Staff/StaffKitchenPage.test.jsx`
- `npm run check:staff-theme`
- `npm run build`
- Manual review at 390x844, 430x932, 768px, 1024px and 1440px when a browser runtime is available.
