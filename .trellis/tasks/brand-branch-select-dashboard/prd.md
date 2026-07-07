# Branch card dashboard action

## Current behavior

The branch card action only updates `manager.selectedRestaurantId`. The selected scope changes silently while the user remains on Brand Management, so the button appears to do nothing even though the surrounding copy promises a quick move to the dashboard.

## Flow traced

`BrandManagement branch card -> useBrandManagement.setSelectedRestaurantId -> manager:navigate event -> ManagerLayout -> dashboard query restaurantId`.

No schema, resolver, service, GraphQL operation, permission, audit, or realtime contract needs to change.

## Scope

- Keep the selected branch as the global manager restaurant scope.
- Dispatch the existing `manager:navigate` event with `page: dashboard` and the selected `restaurantId`.
- Rename the vague `Chọn` action to `Mở dashboard`.
- Preserve branch creation behavior: creating a branch still selects its scope without forcing navigation.
- Add focused component coverage for the button action and event payload.

## Acceptance criteria

- Clicking a branch card action updates the selected restaurant ID.
- The manager dashboard opens with the same `restaurantId` in the navigation query.
- The action text states the result clearly.
- Adding a new branch does not trigger this dashboard navigation path.
- Existing brand, branch, and member management tests continue to pass.

## Out of scope

- Backend or GraphQL changes.
- New routing abstractions or dependencies.
