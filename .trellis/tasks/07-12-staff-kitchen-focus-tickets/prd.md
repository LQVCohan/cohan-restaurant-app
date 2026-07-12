# Staff kitchen focus tickets

## Current behavior

Focus mode keeps the correct live order data, station filtering, permission guards and item status actions, but its order grid uses flexible `1fr` columns. With one or two orders, a ticket stretches across the board, leaving the item name and its action far apart. Item rows also read like a wide table rather than compact kitchen tickets.

## Root cause and flow

`OrderItem.prepStation/status` -> order access guard and station scoping -> `ordersByRestaurantNow` -> `useOrderManagement` -> `StaffKitchenPage` filters/sorts -> `updateOrderItemStatus` action. The data and mutation contract are already correct. The root cause is the focus-only layout boundary in the launcher styles.

## Scope

- Keep sparse orders at a readable ticket width instead of stretching them full screen.
- Present each dish as a clear operational block with quantity, name, status/timing, notes and a nearby primary action.
- Keep urgent, kitchen and bar signals visible through both text and color.
- Preserve all existing data flow, role restrictions, filters, loading/error/empty states and keyboard behavior.
- Support wide boards, tablets and phone widths without horizontal overflow.

## Acceptance criteria

- One order remains a compact left-aligned ticket on wide screens.
- Multiple orders form a dense auto-filling board.
- Each item action is at least 44px high and stays visually attached to that item.
- Notes and urgency remain fully readable; no important kitchen instruction is truncated.
- At 700px and below, tickets use one column and actions remain full width.
- Existing launcher and kitchen page tests continue to pass; build and staff-theme checks pass.

## Out of scope

- No schema, resolver, permission, query, subscription or mutation changes.
- No new order actions, bulk operations, timers or notification sounds.
- No dependency or design-system changes.
