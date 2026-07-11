# Design

## Direction

Use the current manager shell and sage UI, fix state ownership at the existing shared boundaries, and add progressive disclosure for menu dishes inside the current time-slot modal.

## Account isolation

`normalizeUserModel` may reuse fallback fields only when the raw and fallback identities do not conflict. An explicit login starts a new session epoch before waiting, serializes any pending cache reset, clears Apollo account data, and publishes the new token/user only if the epoch is still current. This keeps the existing refresh and late-`Me` guards while removing cross-account field fallback.

## Shared branch scope

`AuthProvider` remains the owner of `myBrandMemberships` and `scopedRestaurants`. It exposes the existing business-context query's `refetch` as `refreshBusinessContext`. After `createRestaurant` succeeds, Brand Management awaits that shared refresh and only then selects the created restaurant. The header and page therefore read the same updated source without a second store.

## Manager destination persistence

A small pure helper validates and normalizes a manager page, writes `manager.currentPage`, and updates the canonical `/manager#page` URL synchronously. Sidebar/search selection calls it in the same user action before React effects. The existing hash listener and permission fallback remain unchanged.

## Menu overview

The public GraphQL contract already supports internal `menuItemsConnection` by `restaurantId` and `timeSlot`. `useMenuManagement` adds one lazy overview operation with four aliases, limited to 200 items per slot. `CompactMenuStrip` calls it only when the user opens the existing list modal and renders native `details/summary` sections under each menu card.

Each menu section shows:

- loading and retry-safe error feedback;
- dish name, price and status;
- an empty state when a menu contains no dishes;
- a note when a slot has more than 200 items.

The normal selected-time-slot item query and menu CRUD flows remain unchanged.

## Files changing

- `src/context/AuthProvider.jsx` — isolate identities, clear account cache on explicit login, expose business-context refresh.
- `src/context/__tests__/AuthProvider.login-race.test.jsx` — account-field and cache-reset regressions.
- `src/components/Dashboard_Manager/Brand/BrandManagement.jsx` — refresh shared business context after branch creation.
- `src/components/Dashboard_Manager/Brand/BrandManagement.test.jsx` — assert refresh ordering and selection.
- `src/layouts/ManagerLayout.jsx` — synchronous canonical destination persistence.
- `src/layouts/ManagerLayout.navigation.test.js` — pure navigation persistence regression.
- `src/hooks/useMenuManagement.js` — lazy grouped menu overview query.
- `src/components/Dashboard_Manager/Menu/MenuManagement.jsx` — pass the lazy loader to the existing menu list.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.jsx` — render dishes per time-slot menu.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.scss` — compact responsive dish rows.
- `src/components/Dashboard_Manager/Menu/components/StatsSection/CompactMenuStrip.test.jsx` — overview loading, grouping and error behavior.
