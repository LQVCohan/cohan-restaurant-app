# Fix manager session, scope and menu overview

## Current behavior and root causes

1. **The manager shell can keep visual state from the previous account.** The shared `AuthProvider` already clears Apollo on logout and rejects stale refresh/`Me` results by session epoch and account ID. The remaining manager route keeps the same `ManagerLayout`, Header, Sidebar and account-center component instances across an account swap, so their local image, dropdown and child-query state can remain visible until reload.
2. **A new branch is not available in the manager header immediately.** Brand Management refreshes `MyBrands`, but the header selector intentionally calls `useBrandManagement` with `loadFullBrands: false`, so it reads the slower AuthContext business snapshot instead of the live query that the mutation already refetches.
3. **Manager reload can fall back to dashboard.** Sidebar selection changes React state first; the canonical hash/local-storage destination is written later in `ManagerLayout`'s effect. A reload immediately after choosing a page can reach `/manager` without the selected hash.
4. **There is no complete menu-and-dish overview.** The current menu page can manage one selected time slot, and its existing list modal shows menu cards/counts only. The backend already supports manager-scoped `menus` and `menuItemsConnection` queries grouped by time slot.

## End-to-end flows traced

- `User / refresh session -> login and Me operations -> AuthProvider -> AuthContext -> manager route -> Header / Sidebar / account center`.
- `Restaurant + BrandMembership -> myBrands -> createRestaurant mutation refetch -> useManagerRestaurantSelection -> header dropdown`.
- `Sidebar action -> ManagerLayout state -> URL hash and localStorage -> browser reload -> initial manager page`.
- `Menu + MenuItem -> menu resolvers -> Apollo query -> manager menu overview modal`.

## Scope

- Remount the complete manager shell whenever the authenticated account ID changes.
- Make the shared manager restaurant selector subscribe to the same live `MyBrands` query that branch creation already refetches.
- Persist sidebar destinations to hash and localStorage in the click action before React effects.
- Add a page-specific “Danh sách thực đơn” modal on the manager menu page, showing menus by breakfast/lunch/dinner/late-night and the dishes in each menu.
- Reuse the existing schema, permission checks, restaurant scope, common modal and manager visual language.

## Acceptance criteria

1. Switching from account A to account B remounts Header, Sidebar and account-center state, immediately showing account B's name, avatar and profile data without browser refresh.
2. Existing AuthProvider stale-refresh, account-ID and Apollo-clear protections remain unchanged.
3. After creating a branch, the manager header dropdown receives it from the refetched `MyBrands` query without reloading.
4. Reloading a manager destination such as `#menu`, `#staff` or `#orders` restores that destination instead of dashboard.
5. The menu overview shows every returned menu, its time-slot/status/count, and dishes belonging to that slot; loading, empty, error and 200-item truncation states are explicit.
6. No new dependency, backend schema, permission rule or restaurant-scope bypass is introduced.

## Out of scope

- Changing authentication or refresh-token contracts.
- Adding realtime subscription infrastructure for brand/restaurant changes.
- Reworking manager routing into a new route tree.
- Changing menu CRUD, recipes, inventory or customer availability rules.
