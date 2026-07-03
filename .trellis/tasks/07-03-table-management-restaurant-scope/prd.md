# Sync table management with manager restaurant scope

## Current behavior

The manager header branch selector updates the shared manager restaurant scope, but the table management page keeps a separate local `selectedRestaurantId` initialized from `AuthContext`. The table page therefore continues querying the previous restaurant after the header selection changes.

## Root cause

`TableManagement.jsx` does not consume the existing `useManagerRestaurantSelection` hook used by the manager header. Its local restaurant state is disconnected from the `manager:scope-selection` synchronization flow.

## Requirements

- Limit the fix to the table management page.
- Reuse `useManagerRestaurantSelection` rather than adding another event listener or state bridge.
- Feed the synchronized restaurant ID into `useRestaurant`, `useFloorManagement`, and `useTableManagement`.
- Keep the page-level restaurant selector synchronized with the manager header.
- Preserve existing table, floor, modal, and mutation behavior.

## Acceptance criteria

- Changing the manager header branch selector causes the table page data hooks to receive the new restaurant ID immediately.
- The page-level restaurant selector shows the same selected branch.
- Table and floor data reload through their existing GraphQL queries when the ID changes.
- No shared selector, backend, schema, resolver, or other manager page is modified.
- A component test proves the restaurant ID passed to the table data hook changes after selecting another branch.

## Out of scope

- Refactoring all manager pages to a single provider.
- Changing brand membership or restaurant authorization logic.
- Adding dependencies or new global state.
