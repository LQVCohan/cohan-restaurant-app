# Design

## Direction

Keep the existing manager shell and sage UI. Remount account-scoped state at the route boundary, reuse the live brand query already refreshed by branch creation, persist navigation in the click action, and add one focused menu catalog modal.

## Account-scoped manager shell

The authentication boundary already prevents stale session callbacks and clears Apollo on logout. The remaining stateful descendants—Header, Sidebar, image failure flags, dropdown state and account-center queries—must not survive a user-ID change. `AppRouter` renders `ManagerLayout` through a small account-scoped component keyed by the authenticated user ID. A new account therefore receives fresh manager component and Apollo hook instances without duplicating auth logic.

## Live branch selector

`useManagerRestaurantSelection` currently requests `loadFullBrands: false`, causing the header to consume the AuthContext business snapshot. It will instead use `loadFullBrands: true`. `BrandManagement` already refetches the exact `MY_BRANDS_QUERY` after `createRestaurant`, so every selector watcher receives the new branch immediately. No new event or store is added.

## Manager destination persistence

Sidebar navigation writes `manager.currentPage` and the canonical hash synchronously before calling `onPageChange`. `ManagerLayout` keeps its existing effect, hash listener and permission fallback as secondary synchronization. The browser now has a durable destination even when reload follows the click immediately.

## Menu catalog

A new `ManagerMenuCatalogModal` uses the existing `Modal` component and one manager-scoped GraphQL operation:

- `menus(restaurantId)` returns menu metadata, including inactive menus for authorized managers;
- four `menuItemsConnection` aliases load up to 200 items for breakfast, lunch, dinner and late night;
- items are matched to their `menuId`, avoiding accidental cross-slot display.

The manager Header shows a “Danh sách thực đơn” action only on the menu page. The modal groups cards by time slot and shows status, dish count, dish name, price and serving status. Missing restaurant, loading, error, empty-menu and truncated-result states are explicit.

## Files changing

- `src/routes/AppRouter.jsx` — account-keyed manager route.
- `src/routes/AppRouter.account-scope.test.jsx` — remount regression.
- `src/hooks/useManagerRestaurantSelection.js` — subscribe to live `MyBrands` data.
- `src/hooks/useManagerRestaurantSelection.test.jsx` — assert the full-brand mode.
- `src/components/Dashboard_Manager/Sidebar.jsx` — persist destination in the user action.
- `src/components/Dashboard_Manager/Sidebar.test.jsx` — reload-state regression.
- `src/components/Dashboard_Manager/Header.jsx` — menu-page catalog launcher.
- `src/components/Dashboard_Manager/Menu/ManagerMenuCatalogModal.jsx` — grouped menu/dish query and UI.
- `src/components/Dashboard_Manager/Menu/ManagerMenuCatalogModal.scss` — responsive catalog styles.
- `src/components/Dashboard_Manager/Menu/ManagerMenuCatalogModal.test.jsx` — grouping, empty, error and close behavior.
