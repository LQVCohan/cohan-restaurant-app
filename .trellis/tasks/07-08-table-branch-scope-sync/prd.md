# Synchronize manager pages with the selected branch

## Current behavior

The manager layout stores the active branch in `manager.selectedRestaurantId` and broadcasts changes through `manager:scope-selection`.

Several older manager pages, including `TableManagement`, still keep a private `selectedRestaurantId` and render that selector through the shared `ManagementPageHeader`. Their GraphQL hooks receive the private value instead of the value selected in the top manager header.

Changing the branch in the top header therefore changes the visible scope label but those pages can continue querying the previous restaurant.

## Root cause

The backend and Apollo contracts are already restaurant-scoped correctly:

`Table.restaurantId` → `tables(restaurantId)` resolver filter → `useTableManagement({ restaurantId })` → table UI.

The drift occurs between two frontend selection states:

1. `ManagerLayout` / `useManagerRestaurantSelection` publishes the manager-wide branch.
2. Legacy pages own a local selector through `ManagementPageHeader` but do not subscribe to that manager-wide branch.

Because every affected legacy selector already passes through `ManagementPageHeader`, the smallest shared fix is to synchronize at that component boundary instead of patching each page separately.

## Implemented flow

1. The top manager selector changes restaurant B.
2. `useBrandManagement` persists B and emits `manager:scope-selection`.
3. `ManagementPageHeader` validates that B exists in the page's allowed `restaurantList`.
4. It invokes the page's existing `onRestaurantChange(B)` callback.
5. `TableManagement` updates its local restaurant ID.
6. `useFloorManagement` and `useTableManagement` rerun with B.
7. Backend permissions are checked and only B's floors/tables are returned.

When a legacy page first opens, `ManagementPageHeader` also reads the persisted manager restaurant and applies it, preventing the page from temporarily remaining on its first `AuthContext` restaurant.

The page-level selector publishes the same manager scope event so the top header and other open manager selectors remain synchronized.

## Files changed

- `src/components/Dashboard_Manager/shared/ManagementPageHeader/ManagementPageHeader.jsx`
  - Subscribe to the existing manager scope event.
  - Apply the persisted branch on mount/list changes.
  - Publish page-level branch changes through the same protocol.
  - Ignore restaurant IDs outside the page's allowed list.
- `src/components/Dashboard_Manager/shared/ManagementPageHeader/ManagementPageHeader.test.jsx`
  - Cover persisted selection, top-header changes, page-level publishing, and out-of-scope IDs.

## Constraints

- Do not change GraphQL schema, table/floor resolvers, or permission guards.
- Do not add a new context, global store, or dependency.
- Reuse the existing `manager.selectedRestaurantId` storage key and `manager:scope-selection` event.
- Never apply a restaurant ID absent from the page's allowed restaurant list.

## Acceptance criteria

- A brand owner/system manager switching from restaurant A to B sees B's floors and tables without reloading.
- The page-level branch selector follows the top manager selector.
- Opening a legacy manager page uses the already selected manager branch.
- Selecting a branch inside a page updates the shared manager scope.
- IDs outside the page's authorized restaurant list are ignored.
- Existing GraphQL restaurant scoping and backend permission checks remain unchanged.

## Out of scope

- Changing brand membership or restaurant access rules.
- Changing the backend `tables` or `floors` contracts.
- Replacing all legacy local states in one refactor.

## Validation plan

- `vitest run src/components/Dashboard_Manager/shared/ManagementPageHeader/ManagementPageHeader.test.jsx`
- Existing table-management component tests.
- `npm run check:graphql`
- `npm run build`
