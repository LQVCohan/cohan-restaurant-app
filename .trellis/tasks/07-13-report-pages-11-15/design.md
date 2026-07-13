# Design

## Data paths

- Leave: local date fields → `useLeaveManagement.toLeaveDateTime` → leave mutation → friendly message mapper → shared notification provider.
- Schedule: `staffList.employmentType` → normalized staff view model → assigned staff lookup → contract mix badges; start/end time is used only for duration.
- Payroll: `payrollSettings` query → immutable saved-form projection + editable form projection → per-field current-value pill → existing update mutation/refetch.
- Customer order: `customerListSummaries.recentOrders.id` → `manager:navigate` query → `useOrderManagement.fetchOrderById` → existing `OrderModal`.

## UI decisions

- Current payroll values are concise pills above the input and use Vietnamese numeric formatting.
- Schedule cards show up to two contract-type pills and a neutral duration badge.
- Dashboard roster becomes a normal child in the side stack; existing responsive grid selectors continue to place it.
- Recovery and deep-link actions are native buttons/links with visible focus states.

## Safety

- The order detail query continues through the backend `order(id)` guard; no order payload is trusted from customer summary data.
- Global notification sanitization replaces clearly technical exception payloads but preserves recognizable order codes.
- Reduced-motion users receive immediate rather than animated active-item scrolling.
