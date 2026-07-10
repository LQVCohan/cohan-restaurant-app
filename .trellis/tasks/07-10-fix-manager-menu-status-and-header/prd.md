# Manager menu status visibility and header access

## Current behavior

- Manager menu uses `menuItemsConnection` with `status: null` for the “Tất cả trạng thái” option.
- The resolver treats a connection query without an inactive status as public browsing and applies `status in [available, out_of_stock]`.
- After changing a dish to `unavailable`, the mutation succeeds, then `refetchItems()` removes the dish from the manager list.
- Manager content owns an internal scroll container. Scroll reset currently lives in `Sidebar` through a DOM query, so it does not reliably cover same-page navigation and other manager navigation paths.

## Root cause

1. The GraphQL contract has no explicit manager/internal list flag. A null status is ambiguous between public browsing and manager “all statuses”.
2. Scroll ownership and scroll reset are split between `ManagerLayout` and `Sidebar` instead of being handled at the shared layout boundary.

## End-to-end flow

- `MenuItem.status` values: `available | unavailable | out_of_stock | hidden`.
- `toggleMenuItemStatus` persists the selected status.
- `useMenuManagement` refetches `menuItemsConnection` after the mutation.
- `MenuQuery.menuItemsConnection` chooses public or internal filtering.
- `MenuManagement` renders the returned items and applies only inventory/For You client filters.
- `ManagerLayout` owns `.manager-layout__content`; Sidebar and custom navigation update `currentPage`.

## Scope

- Add an explicit `includeInactive` field to `MenuItemFilter`.
- Make the resolver recognize `filter.includeInactive` as an internal query and preserve permission checks.
- Send `includeInactive: true` only from the manager menu hook.
- Add a focused resolver test proving all-status manager queries do not receive the public status restriction.
- Move scroll reset to `ManagerLayout` and remove the Sidebar DOM query.

## Acceptance criteria

- Changing a dish to `unavailable` keeps it visible when status filter is “Tất cả trạng thái”.
- Selecting a specific status still filters correctly.
- Public menu queries still expose only browsable statuses.
- Internal all-status queries require `menu.read` access.
- Entering or reselecting the Menu page returns the manager content scroll position to the top so the page header/menu controls are visible.

## Out of scope

- Redesigning menu cards or toolbar.
- Changing customer-facing status visibility.
- Changing mutation behavior or status enum values.
