# Design

## Direction

Compact restaurant-operations UI using the existing sage manager surfaces: operational state and the next action appear first, secondary history/configuration is progressively disclosed, and destructive actions remain explicit red controls.

## Root-cause boundaries and caller flow

1. Order: `Order/order item -> order status/void mutations -> useOrderManagement -> OrderManagement -> OrderModal/ItemModal/HistoryModal/NewOrderModal -> component tests`.
2. Menu: `Menu/MenuItem -> menus and menuItemsConnection -> Header/ManagerMenuCatalogModal and CompactMenuStrip -> component tests`.
3. Stock: `Ingredient/Supply -> existing receive-stock caller -> QuickStockModal row selection/payload -> component tests`.
4. Table: `Table/tableCustomer -> existing queries/installMergedTableCustomerProfiles -> installTableDetailModalTabs -> TableActionsLiteModal -> DOM regression test`.
5. Table settings: `Table/Floor -> useTableManagement/useFloorManagement -> TableTypeManagementPage -> component and responsive checks`.

## Planned files

- `OrderModal.jsx/.scss` and test: explicit next-action status rail, destructive action placement and plain wording.
- `ItemModal.jsx/.module.scss` and test: operational detail hierarchy and plain wording.
- `HistoryModal.jsx/.scss` and test: compact list/empty states.
- `NewOrderModal.jsx/.scss` and test: table chooser in the review column.
- `ManagerMenuCatalogModal.jsx/.scss`, `Header.jsx` and tests: correct item grouping and direct management route.
- `QuickStockModal.jsx/.scss` and test: explicit row selection and subset validation.
- `installTableDetailModalTabs.js` and test: deterministic late-inserted customer-panel visibility.
- `TableTypeManagementPage.jsx/.scss` and test: denser layout with list-first information hierarchy.

## Validation

- Targeted Vitest for every changed component/helper.
- `npm run check:conflicts` and `npm run check:graphql` if contracts are touched.
- Production frontend build.
- Desktop and phone screenshots when an authenticated local manager session can be started; otherwise record the missing browser check explicitly.
