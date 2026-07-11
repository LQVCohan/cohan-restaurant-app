# Design

## Direction

Keep the existing manager shell and sage UI. Reset account-scoped local state where it lives, reuse the live brand query already refreshed by branch creation, persist navigation in the click action, and add one focused menu catalog modal.

## Account-scoped manager UI

The authentication boundary already prevents stale session callbacks and clears Apollo on logout. The remaining stateful descendants—Header and Sidebar image failure flags, dropdown state and the account-center overlay—must not survive a user-ID change. Header observes the authenticated account ID, closes account-specific overlays, resets its avatar state and keys account-center content by account and tab. Sidebar also resets avatar-local state from the account ID. This avoids duplicating or weakening AuthProvider logic.

## Live branch selector

`useManagerRestaurantSelection` currently requests `loadFullBrands: false`, causing the header to consume the AuthContext business snapshot. It now uses `loadFullBrands: true`. `BrandManagement` already refetches the exact `MY_BRANDS_QUERY` after `createRestaurant`, so every selector watcher receives the new branch immediately. No new event or store is added.

## Manager destination persistence

Sidebar navigation writes `manager.currentPage` and the canonical hash synchronously before calling `onPageChange`. `ManagerLayout` keeps its existing effect, hash listener and permission fallback as secondary synchronization. The browser now has a durable destination even when reload follows the click immediately.

## Menu catalog

A new `ManagerMenuCatalogModal` uses the existing `Modal` component and one manager-scoped GraphQL operation:

- `menus(restaurantId)` returns menu metadata, including inactive menus for authorized managers;
- four `menuItemsConnection` aliases load up to 200 items for breakfast, lunch, dinner and late night;
- items are matched to their `menuId`, avoiding accidental cross-slot display.

The manager Header shows a “Danh sách thực đơn” action only on the menu page. The modal groups cards by time slot and shows status, dish count, dish name, price and serving status. Missing restaurant, loading, error, empty-menu and truncated-result states are explicit.

## Files changing

- `src/components/Dashboard_Manager/Header.jsx` — reset account-local state and add the menu-page catalog launcher.
- `src/components/Dashboard_Manager/Header.account-switch.test.jsx` — identity-reset and catalog-launch regressions.
- `src/hooks/useManagerRestaurantSelection.js` — subscribe to live `MyBrands` data.
- `src/hooks/useManagerRestaurantSelection.test.jsx` — assert the full-brand query and shared selection behavior.
- `src/components/Dashboard_Manager/Sidebar.jsx` — reset avatar-local state and persist destination in the user action.
- `src/components/Dashboard_Manager/Sidebar.test.jsx` — reload-state regression.
- `src/components/Dashboard_Manager/Menu/ManagerMenuCatalogModal.jsx` — grouped menu/dish query and UI.
- `src/components/Dashboard_Manager/Menu/ManagerMenuCatalogModal.scss` — responsive catalog styles.
- `src/components/Dashboard_Manager/Menu/ManagerMenuCatalogModal.test.jsx` — grouping, empty and error behavior.
