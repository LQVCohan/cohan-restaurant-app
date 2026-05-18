# MenuManagement QA Checklist (Final Demo Readiness)

Use this checklist before graduation project review. Scope focuses on MenuManagement only (no PBAC changes).

## 1) Backend startup & schema health
- [ ] Start backend: `npm run dev --prefix cohan-restaurant-backend`
- [ ] Start frontend: `npm run dev`
- [ ] Verify backend health endpoint responds (`/health/live`, `/health/ready`).
- [ ] Verify GraphQL schema loads with no resolver/schema mismatch warnings.
- [ ] Verify no `Unknown field` GraphQL errors in server log during MenuManagement flows.

## 2) GraphQL menu queries
- [ ] `menus` returns menu list by restaurant and includes `timeSlot`, `isActive`, `coverImage`.
- [ ] `menuItems` returns items with status and category mapping.
- [ ] `menuItemsConnection` supports pagination/sort/filter and returns stable edges/pageInfo.
- [ ] `topMenuItems` returns values based on real counters/rating (not mock-only values).

## 3) Menu operations
- [ ] Create new menu with valid `timeSlot` and display in list.
- [ ] Update menu fields (`name`, `description`, `coverImage`, active state).
- [ ] Copy menu (`copyMenu`) copies expected MenuItem/Recipe data.
- [ ] Delete empty menu succeeds without force mode.
- [ ] Delete non-empty menu blocked without force mode.
- [ ] Force delete non-empty menu succeeds and cleanup is reflected in UI.
- [ ] Toggle menu active/hidden state and verify list/detail refetch.

## 4) MenuItem operations
- [ ] Create MenuItem under correct menu/category.
- [ ] Update MenuItem content and media fields.
- [ ] Delete MenuItem and verify list updates without stale row.
- [ ] Validate statuses: `available`, `unavailable`, `out_of_stock`, `hidden`.
- [ ] Validate serving variants render correctly.
- [ ] Validate BY_WEIGHT variant behavior.
- [ ] Validate price display (default + variant price mapping).
- [ ] Validate bulk price update reflects across target items.

## 5) Category and MenuGroup
- [ ] Create/update/delete Dish Category.
- [ ] Verify Dish Category icon persists after refresh.
- [ ] Create/update/delete Menu Group (`CategoryMenu`).
- [ ] Verify Menu Group icon persists after refresh.

## 6) Inventory behavior
- [ ] `inventoryStatus = IN_STOCK` displays available state.
- [ ] `inventoryStatus = LOW_STOCK` shows warning state.
- [ ] `inventoryStatus = OUT_OF_STOCK` maps to unavailable/out-of-stock UX.
- [ ] `inventoryStatus = ERROR` shows recoverable warning.
- [ ] `inventoryStatus = NOT_TRACKED` behaves as expected for non-tracked items.
- [ ] Run sync in `dry-run` mode and validate preview counts only.
- [ ] Start confirm flow then cancel and verify no persisted status changes.
- [ ] Confirm real sync and verify updated statuses + summary result.
- [ ] Recover item from out_of_stock back to available after stock restoration.
- [ ] Validate quick filters (all / in-stock / low / out-of-stock / issues).

## 7) Image pipeline (production-safe + local fallback)
- [ ] `Menu.coverImage` upload success via server adapter.
- [ ] `Menu.coverImage` local fallback works when upload unavailable.
- [ ] `MenuItem.thumbImage` upload success via server adapter.
- [ ] `MenuItem.thumbImage` local fallback works with warning.
- [ ] Refresh browser and verify IndexedDB preview persistence behavior.
- [ ] Validate cross-device limitation warning for local-only images.

## 8) AuditLog verification
- [ ] `copy_menu` event is written with actor + target context.
- [ ] `delete_menu` event is written (including force-delete case).
- [ ] `sync_inventory_status` event is written for confirmed sync.

## 9) Regression checks
- [ ] No schema/resolver mismatch after all operations.
- [ ] No unknown GraphQL field errors in client logs/network responses.
- [ ] UI refetch/refresh occurs after mutations (no stale lists/cards).
- [ ] No stale `imageSyncStatus` banner after successful upload/sync paths.

## 10) Suggested run order for final demo day
1. Seed demo data (see `docs/menu-management-demo-data.md`).
2. Backend + frontend start.
3. Run GraphQL query checks.
4. Run menu and menu-item CRUD checks.
5. Run inventory sync dry-run → cancel confirm → confirm sync.
6. Run image upload + local fallback checks.
7. Validate AuditLog records and regression list.
