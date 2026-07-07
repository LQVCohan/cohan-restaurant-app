# Branch selection action

## Current behavior

The branch card button updates `manager.selectedRestaurantId`, but the page stays in Brand Management. Because the nearby copy promises a quick switch to the dashboard, the click appears to have no result.

## Flow traced

This is a frontend-only interaction:

`BrandManagement button -> useBrandManagement.setSelectedRestaurantId -> manager scope synchronization -> ManagerLayout`.

No schema, resolver, service, permission, or mutation change is required.

## Scope

- Keep the clicked restaurant as the global manager scope.
- When an existing branch is selected from `#brands`, use the existing `manager:navigate` event to open the dashboard with the same `restaurantId`.
- Keep automatic selection and branch creation behavior unchanged.
- Add a focused hook test.

## Acceptance criteria

- Selecting an existing branch on Brand Management updates the restaurant scope.
- The manager navigation event opens `dashboard` with the selected `restaurantId`.
- Automatic selection does not navigate.
- Selection from other manager pages keeps its current behavior.

## Out of scope

- Backend and GraphQL changes.
- New dependencies or navigation abstractions.

## Validation

Run `useManagerRestaurantSelection.test.jsx` and review the focused diff.
