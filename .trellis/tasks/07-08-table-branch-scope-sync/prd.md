# Synchronize table management with selected branch

## Current behavior

The manager header uses `useManagerRestaurantSelection` and stores the active branch in `manager.selectedRestaurantId`.

`TableManagement` does not use that shared selection. It creates a private `selectedRestaurantId`, initializes it from the first restaurant in `AuthContext.restaurants`, and passes that value to `useFloorManagement` and `useTableManagement`.

Changing the branch in the manager header therefore updates the header only; the table page continues querying the first restaurant.

## Root cause

There are two independent restaurant-selection states in the same manager page:

1. `ManagerLayout` / `useManagerRestaurantSelection` for the global header.
2. A local `useState` inside `TableManagement` for floors and tables.

The GraphQL schema, resolver, and Apollo table hook already scope correctly by the `restaurantId` variable. The wrong variable originates in the page component.

## End-to-end flow

1. The user changes the branch in `BrandRestaurantSelector`.
2. `useManagerRestaurantSelection` updates `manager.selectedRestaurantId` and dispatches `manager:scope-selection`.
3. `TableManagement` uses the same hook and receives the new selected restaurant ID.
4. `useFloorManagement({ restaurantId })` and `useTableManagement({ restaurantId })` rerun with the new ID.
5. The backend validates access and filters `Floor` and `Table` records by that restaurant ID.
6. The page displays only the selected branch's floors and tables.

## Scope

- Replace the private restaurant-selection state in `TableManagement` with `useManagerRestaurantSelection`.
- Use `restaurantOptions` for the page-level branch selector.
- Reset the selected floor to “Tất cả tầng” when the branch changes.
- Close an open table-detail modal when the branch changes so a table from the previous branch cannot remain editable under the new branch context.
- Add a focused component test proving that a shared branch-selection change reaches both table and floor hooks.

## Files to change

- `src/components/Dashboard_Manager/Table/TableManagement.jsx`
  - Remove the duplicate AuthContext restaurant state.
  - Reuse the shared manager restaurant selection.
  - Reset branch-specific UI state on restaurant changes.
- `src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
  - Mock the shared selection hook.
  - Assert that changing the selected branch updates the restaurant ID passed to data hooks.

## Constraints

- Do not change the GraphQL schema or backend resolver because their restaurant scoping is already correct.
- Do not introduce a new context or dependency.
- Preserve the existing page-level restaurant selector and manager header synchronization.
- Preserve backend permission checks.

## Acceptance criteria

- A brand owner/system manager switching from restaurant A to restaurant B sees restaurant B's floors and tables without reloading the page.
- The page-level branch selector and global manager header show the same active restaurant.
- `useTableManagement` and `useFloorManagement` receive the new restaurant ID.
- An open table-detail modal from restaurant A is closed when switching to restaurant B.
- The floor filter resets to “Tất cả tầng”.
- Existing table-management rendering and actions remain unchanged.

## Out of scope

- Changing brand membership or restaurant access rules.
- Changing the backend `tables` or `floors` query contracts.
- Refactoring every manager page to a new provider.

## Validation plan

- `vitest run src/components/Dashboard_Manager/Table/TableManagement.test.jsx`
- `npm run check:graphql`
- `npm run build`
