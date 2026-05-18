# MenuManagement QA Checklist (Final Demo Readiness)

Use this checklist before graduation project review. Scope focuses on MenuManagement only.

## 1) Backend startup & schema health
- [ ] Start backend: `npm run dev --prefix cohan-restaurant-backend`
- [ ] Start frontend: `npm run dev`
- [ ] Verify backend health endpoint responds (`/health/live`, `/health/ready`).
- [ ] Verify GraphQL schema loads with no resolver/schema mismatch warnings.
- [ ] Verify no `Unknown field` GraphQL errors in server log during MenuManagement flows.
- [ ] Run RBAC seed before permission testing: `npm run seed:rbac --prefix cohan-restaurant-backend`.
- [ ] Restart backend and log in again after RBAC seed so the auth context receives fresh role permissions.

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
- [ ] `auditLogs` rejects restaurant users without `menu.audit.read`, `log.read`, or fallback `menu.write`.
- [ ] `auditLogs` allows roles with `menu.audit.read`, `log.read`, or fallback `menu.write`.

## 9) MenuManagement RBAC matrix

Run these checks after `npm run seed:rbac --prefix cohan-restaurant-backend`, backend restart, and fresh login.

| Role | Expected MenuManagement access |
| --- | --- |
| `admin` | Full access. Can perform every MenuManagement action. |
| `manager` | Full MenuManagement access: menu CRUD, copy/delete, item CRUD, bulk price, category/menu group, sync inventory, audit history. |
| `server` | Read menu only. Must not see or successfully call create/update/delete/copy/sync/audit actions. |
| `host` | Read menu only. Must not see or successfully call write actions. |
| `cashier` | Read menu only. Must not see or successfully call write actions. |
| `supervisor` | Can read menu, update item, update price, view audit. Must not create/delete/copy menu or manage categories/groups. |
| `chef` / `cook` | Can read menu and update item status/content allowed by UI. Must not update price, copy/delete menu, manage categories/groups, or view audit unless separately granted. |
| `storekeeper` | Can read menu and sync inventory. Must not create/delete/copy menu, update price, or manage categories/groups. |
| `customer` | Must not access Dashboard Manager MenuManagement route. |

### RBAC UI visibility checks
- [ ] Role without `menu.create`/`menu.write` does not see “Tạo thực đơn”.
- [ ] Role without `menu.update`/`menu.write` does not see edit/toggle menu actions.
- [ ] Role without `menu.delete`/`menu.write` does not see delete menu action.
- [ ] Role without `menu.copy`/`menu.write` does not see copy menu action.
- [ ] Role without `menu.inventory.sync`/`inventory.write`/`menu.write` does not see “Đồng bộ tồn kho”.
- [ ] Role without `menu.audit.read`/`log.read`/`menu.write` does not see audit history action.
- [ ] Role without `menu.item.create`/`menu.write` cannot create item.
- [ ] Role without `menu.item.update`/`menu.write` cannot update item/status.
- [ ] Role without `menu.item.delete`/`menu.write` cannot delete item.
- [ ] Role without `menu.price.update`/`menu.write` cannot bulk update price.
- [ ] Role without `menu.category.manage`/`menu.write` cannot manage Dish Category.
- [ ] Role without `menu.group.manage`/`menu.write` cannot manage Menu Group.

### RBAC backend enforcement checks
For each restricted role, verify the GraphQL mutation returns `FORBIDDEN` or `FORBIDDEN_MENU_PERMISSION` when called directly from GraphQL client/network tools:

- [ ] `ensureMenu` without `menu.create` or `menu.update`.
- [ ] `copyMenu` without `menu.copy`.
- [ ] `deleteMenu` without `menu.delete`.
- [ ] `createMenuItem` without `menu.item.create`.
- [ ] `updateMenuItem` without `menu.item.update`.
- [ ] `deleteMenuItem` without `menu.item.delete`.
- [ ] `bulkUpdateMenuItemPrices` without `menu.price.update`.
- [ ] `syncMenuItemInventoryStatuses` without `menu.inventory.sync`/`inventory.write`.
- [ ] `createCategory`, `updateCategory`, `deleteCategory` without `menu.category.manage`.
- [ ] `createCategoryMenu`, `updateCategoryMenu`, `deleteCategoryMenu` without `menu.group.manage`.
- [ ] `auditLogs` without `menu.audit.read`/`log.read`.

## 10) Regression checks
- [ ] No schema/resolver mismatch after all operations.
- [ ] No unknown GraphQL field errors in client logs/network responses.
- [ ] UI refetch/refresh occurs after mutations (no stale lists/cards).
- [ ] No stale `imageSyncStatus` banner after successful upload/sync paths.
- [ ] RBAC fallback `menu.write` still works for legacy roles while granular permissions are being rolled out.

## 11) Suggested run order for final demo day
1. Seed RBAC: `npm run seed:rbac --prefix cohan-restaurant-backend`.
2. Seed demo data (see `docs/menu-management-demo-data.md`).
3. Restart backend + frontend.
4. Log out and log in again with the role being tested.
5. Run GraphQL query checks.
6. Run menu and menu-item CRUD checks.
7. Run inventory sync dry-run → cancel confirm → confirm sync.
8. Run image upload + local fallback checks.
9. Validate AuditLog records and regression list.
10. Validate MenuManagement RBAC matrix role by role.
