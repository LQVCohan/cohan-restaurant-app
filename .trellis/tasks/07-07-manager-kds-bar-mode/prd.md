# Manager KDS bar mode

## Current behavior

The manager order page has a fullscreen `focusMode` labelled "Màn hình Bếp". It renders all active order items together and has no way to view the bar queue separately. Its local `ordersByRestaurantNow` operation does not request the station field even though the backend already exposes it. The fullscreen container also loses its dark canvas because a more specific manager-shell transparency rule wins in the cascade, leaving a dark header above a light content background.

## Root cause

- The preparation-station contract is complete in persistence and backend enrichment, but `OrderManagement.jsx` omits `items.station` from its local GraphQL selection.
- Focus-mode rendering filters whole orders rather than item lines by preparation station.
- The focus-mode stylesheet does not out-rank the shared manager-shell top-level background reset.

## End-to-end flow

1. `OrderItem.prepStation` snapshots the menu configuration (`kitchen | bar`).
2. `KitchenOrderWorkItem.station` preserves the operational station during status changes.
3. `ordersByRestaurantNow` calls `attachKitchenWorkItemInfoToOrders` and exposes each item as `OrderItem.station`.
4. `OrderManagement.jsx` loads the active order connection and uses `updateOrderItemStatus` through `useOrderManagement` for item updates.
5. Fullscreen focus mode will filter item lines by station while keeping restaurant scoping, query/refetch, realtime and mutations unchanged.

## Scope

- Request `station` in the manager order query.
- Add manager focus modes for Bếp chính, Quầy bar and Tổng hợp.
- Show live active-line counts before switching modes.
- Filter displayed order items and dish summaries by the selected station.
- Use item-status buckets for focus-mode status filtering.
- Change focus title and empty copy to match the selected station.
- Repair the fullscreen dark canvas and add a restrained blue bar accent.
- Preserve the normal order-management screen and all backend behavior.

## Files changed

- `src/components/Dashboard_Manager/Order/OrderManagement.jsx`
- `src/components/Dashboard_Manager/Order/OrderKitchenModeFix.css`
- `src/components/Dashboard_Manager/Order/OrderManagement.test.jsx`

## Acceptance criteria

1. Entering focus mode starts in Bếp chính.
2. Managers can switch between Bếp chính, Quầy bar and Tổng hợp.
3. Each mode displays only matching item lines; orders without matching lines are hidden.
4. Switcher counts show active pending/preparing lines for each station.
5. Dish summaries use only item lines visible in the selected mode.
6. Bar mode has a distinct label and restrained blue accent without relying on color alone.
7. The whole fullscreen screen uses one dark canvas, including empty states.
8. Controls remain native buttons with visible focus and usable touch targets.
9. Normal order management, restaurant selection, realtime refetch and mutations remain unchanged.

## Out of scope

- Changing preparation-station persistence, migrations or backend routing.
- Creating a separate bar route or duplicate fetching flow.
- Reassigning an existing work item to another station.
- Splitting combo children into multiple stations.
- Replacing existing order cards or changing order/item status business rules.

## Validation

- `npx vitest run src/components/Dashboard_Manager/Order/OrderManagement.test.jsx`
- `npm run check:graphql`
- `npm run build`
- Desktop visual review plus 390×844 and 430×932 when a browser checkout is available.
