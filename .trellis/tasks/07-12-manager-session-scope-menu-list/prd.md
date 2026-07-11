# Fix manager session, scope and menu overview

## Current behavior and root causes

1. **Account switching can retain the previous profile.** `AuthProvider` protects against stale refresh and late `Me` responses, but `normalizeUserModel` still merges the previous user as fallback without confirming both records belong to the same account. Apollo state is cleared on explicit logout only, so another login path may still expose cached account data briefly.
2. **A new branch is not available in the manager header immediately.** The branch screen refreshes `MyBrands`, while the shared header uses `AuthContext` business context (`myBrandMemberships` and `scopedRestaurants`). The two sources remain out of sync until reload.
3. **Manager reload can fall back to dashboard.** Sidebar selection changes React state first; the canonical hash/local-storage destination is written later in an effect. A reload before that effect leaves `/manager` without a destination.
4. **The menu overview does not show dishes inside each time-slot menu.** The existing list modal renders the four menu slots and counts only. The backend already supports internal `menuItemsConnection` queries by restaurant and time slot.

## End-to-end flows traced

- `User / refresh session -> login and Me operations -> AuthProvider -> AuthContext -> Header / Sidebar profile`.
- `Restaurant + BrandMembership -> scopedRestaurants / myBrands -> AuthProvider and useBrandManagement -> manager header selector`.
- `Sidebar action -> ManagerLayout state -> URL hash and localStorage -> browser reload -> initial manager page`.
- `Menu + MenuItem -> menu resolvers -> useMenuManagement -> MenuManagement -> CompactMenuStrip list modal`.

## Scope

- Isolate account data at the shared auth boundary and clear Apollo account state before publishing an explicit login.
- Expose one shared business-context refresh from `AuthProvider`; call it after branch creation before selecting the new branch.
- Persist manager page destination synchronously when the user chooses it.
- Lazily load and display dishes grouped under each menu/time slot inside the existing menu-list modal.
- Reuse existing GraphQL schema, permission checks, restaurant scope, components and visual tokens.

## Acceptance criteria

1. Switching from account A to account B updates name, avatar, email, roles and restaurant scope without a browser refresh; no field may fall back from account A.
2. Late refresh or `Me` work from account A cannot overwrite account B.
3. After creating a branch, the manager header dropdown receives it immediately and selects it after shared business context refreshes.
4. Reloading a manager destination such as `#menu`, `#staff` or `#orders` restores that destination instead of dashboard.
5. The menu-list modal shows all four time slots, each existing menu, and the dishes belonging to that menu; empty, loading, error and truncated-result states remain understandable.
6. No new dependency, backend schema, permission rule or restaurant-scope bypass is introduced.

## Out of scope

- Changing authentication or refresh-token contracts.
- Adding realtime subscription infrastructure for brand/restaurant changes.
- Reworking manager routing into a new route tree.
- Changing menu CRUD, recipes, inventory or customer menu availability rules.
