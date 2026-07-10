# Manager menu status visibility and header access

## Current behavior

- Manager menu uses `menuItemsConnection` with `status: null` for the “Tất cả trạng thái” option.
- The resolver previously treated that request as public browsing and applied `status in [available, out_of_stock]`.
- After changing a dish to `unavailable`, the mutation succeeded, then `refetchItems()` removed the dish from the manager list.
- Sidebar navigation reset the manager scroll position before React completed the page transition, so the Menu page could remain below its management header.

## Root cause

1. `menuItemsConnection` identified internal queries only from an explicitly inactive status. It did not recognize an authenticated user with `menu.read` when the status filter was empty.
2. The scroll reset ran synchronously with `onPageChange`, creating a race with page rendering and browser scroll restoration.

## End-to-end flow

- `MenuItem.status` supports `available | unavailable | out_of_stock | hidden`.
- `toggleMenuItemStatus` persists the selected status.
- `useMenuManagement` refetches `menuItemsConnection` after the mutation.
- `MenuQuery.menuItemsConnection` decides whether to apply public status restrictions.
- `MenuManagement` renders the returned items and applies only inventory/For You client filters.
- Sidebar changes the current manager page and `.manager-layout__content` owns page scrolling.

## Implemented scope

- Treat an authenticated user with `menu.read` as an internal menu-list caller.
- Preserve restaurant access and `menu.read` authorization through `requireRestaurantPermission`.
- Keep public/unauthenticated requests restricted to browsable statuses.
- Add a focused resolver regression test for manager all-status and public listing behavior.
- Reset the manager content scroll on the next animation frame after sidebar navigation.

## Acceptance criteria

- Changing a dish to `unavailable` keeps it visible when status filter is “Tất cả trạng thái”.
- Selecting a specific status still filters correctly.
- Public menu queries still expose only browsable statuses.
- Internal all-status queries require restaurant access and `menu.read`.
- Entering or reselecting the Menu page returns the manager content scroll position to the top so the page header and menu controls are visible.

## Out of scope

- Redesigning menu cards or toolbar.
- Changing customer-facing status visibility.
- Changing mutation behavior, GraphQL input types, or status enum values.
