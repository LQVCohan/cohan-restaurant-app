# Modal Audit & Draft Persistence (2026-04-09)

## Scope & method
- Enumerated modal-like components by filename/pattern (`Modal|Dialog|Drawer|Sheet|Popup`) and runtime dialog signals (`aria-modal`, `role="dialog"`, overlay + onClose).
- Classified whether each component has user input and submit-like behavior by static JSX scan.
- Marked implementation status for this pass (`Implemented`, `Deferred`, `Not applicable`).

## Full inventory
| # | Component file | Input | Submit | Upload/Image | Status | Notes |
|---:|---|---|---|---|---|---|
| 1 | `src/components/Customer/AddressPage/AddressModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 2 | `src/components/Customer/BookingDishesModal/ModifierModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 3 | `src/components/Customer/BookingDishesModal/OrderSummaryModal.jsx` | Yes | No | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 4 | `src/components/Customer/BookingTableModal/BookingModal.jsx` | Yes | No | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 5 | `src/components/Customer/NotifyModal/NotifyModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 6 | `src/components/Customer/OrdersManagement/modals/CancelOrderModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 7 | `src/components/Customer/OrdersManagement/modals/ChangeTableModal.jsx` | Yes | Yes | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 8 | `src/components/Customer/OrdersManagement/modals/ChangeTimeModal.jsx` | Yes | Yes | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 9 | `src/components/Customer/OrdersManagement/modals/Modals.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 10 | `src/components/Customer/OrdersManagement/modals/TrackingModal.jsx` | No | No | Yes | Not applicable | View/confirm/info modal; no form draft needed. |
| 11 | `src/components/Customer/QRPaymentModal/QRPaymentModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 12 | `src/components/Customer/RestaurantMenu/components/ProductModal.jsx` | Yes | No | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 13 | `src/components/Customer/SuccessModal/SuccessModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 14 | `src/components/Customer/TableBooking/ConfirmationModal/ConfirmationModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 15 | `src/components/Dashboard_Manager/Customer/AddCustomerModal.jsx` | Yes | No | No | Deferred | Contains sensitive payment/PII fields; needs stricter field policy before rollout. |
| 16 | `src/components/Dashboard_Manager/Customer/CustomerModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 17 | `src/components/Dashboard_Manager/Customer/OrderBillModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 18 | `src/components/Dashboard_Manager/Customer/PromotionModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 19 | `src/components/Dashboard_Manager/Menu/components/CategoryModal/CategoryModal.jsx` | Yes | Yes | No | Implemented | Draft persistence added in this pass. |
| 20 | `src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx` | Yes | Yes | Yes | Implemented | Draft persistence added in this pass. |
| 21 | `src/components/Dashboard_Manager/Menu/components/MenuModal/MenuModal.jsx` | Yes | Yes | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 22 | `src/components/Dashboard_Manager/Menu/components/PriceEditModal/PriceEditModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 23 | `src/components/Dashboard_Manager/Menu/components/PromotionModal/PromotionModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 24 | `src/components/Dashboard_Manager/Order/components/HistoryModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 25 | `src/components/Dashboard_Manager/Order/components/ItemModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 26 | `src/components/Dashboard_Manager/Order/components/NewOrderModal.jsx` | Yes | No | Yes | Implemented | Draft enabled with order-line whitelist and no file/blob restore. |
| 27 | `src/components/Dashboard_Manager/Order/components/OrderModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 28 | `src/components/Dashboard_Manager/Order/components/OrderSettingsModal.jsx` | Yes | No | No | Implemented | Draft persistence added in this pass. |
| 29 | `src/components/Dashboard_Manager/POS/components/modals/ConfirmDeleteModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 30 | `src/components/Dashboard_Manager/POS/components/modals/ConfirmSaveTakingOrderModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 31 | `src/components/Dashboard_Manager/POS/components/modals/MenuItemModal.jsx` | Yes | No | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 32 | `src/components/Dashboard_Manager/POS/components/modals/OrderConfirmModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 33 | `src/components/Dashboard_Manager/POS/components/modals/PaymentModal.jsx` | Yes | No | Yes | Deferred | Contains sensitive payment/PII fields; needs stricter field policy before rollout. |
| 34 | `src/components/Dashboard_Manager/POS/components/modals/PrintModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 35 | `src/components/Dashboard_Manager/POS/components/modals/PrintQueueModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 36 | `src/components/Dashboard_Manager/POS/components/modals/PrinterSettingsModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 37 | `src/components/Dashboard_Manager/POS/components/modals/ReceiptModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 38 | `src/components/Dashboard_Manager/POS/components/modals/RegularCustomerModal.jsx` | Yes | No | No | Implemented | Draft enabled with strict whitelist (exclude name/phone/email). |
| 39 | `src/components/Dashboard_Manager/POS/components/modals/ReservationModal.jsx` | Yes | No | No | Implemented | Draft enabled with sensitive field exclusion for guest identity fields. |
| 40 | `src/components/Dashboard_Manager/POS/components/modals/SplitTableModal.jsx` | Yes | No | No | Implemented | Draft persistence added in this pass. |
| 41 | `src/components/Dashboard_Manager/POS/components/modals/SwitchTableConfirmModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 42 | `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 43 | `src/components/Dashboard_Manager/POS/components/modals/useModalKeyboardClose.js` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 44 | `src/components/Dashboard_Manager/Promotion/components/PromotionModal/PromotionModal.jsx` | Yes | Yes | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 45 | `src/components/Dashboard_Manager/Promotion/components/VoucherModal/VoucherModal.jsx` | Yes | Yes | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 46 | `src/components/Dashboard_Manager/Promotion/components/VoucherPackageModal/VoucherPackageModal.jsx` | Yes | Yes | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 47 | `src/components/Dashboard_Manager/Review/components/ReviewModal.jsx` | Yes | No | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 48 | `src/components/Dashboard_Manager/Schedule/components/AddShiftModal.jsx` | Yes | Yes | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 49 | `src/components/Dashboard_Manager/Schedule/components/AutoScheduleModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 50 | `src/components/Dashboard_Manager/Schedule/components/ShiftDetailModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 51 | `src/components/Dashboard_Manager/Staff/components/modals/EmployeeEditModal/EmployeeEditModal.jsx` | Yes | Yes | No | Implemented | Draft persistence added in this pass. |
| 52 | `src/components/Dashboard_Manager/Staff/components/modals/EmployeeFormModal/EmployeeFormModal.jsx` | Yes | Yes | No | Implemented | Draft persistence added in this pass. |
| 53 | `src/components/Dashboard_Manager/Staff/components/modals/WorkHistoryModal/WorkHistoryModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 54 | `src/components/Dashboard_Manager/Storage/components/allocation/AllocationModal.jsx` | No | Yes | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 55 | `src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCategoryManagerModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 56 | `src/components/Dashboard_Manager/Storage/components/ingredients/IngredientModal.jsx` | Yes | Yes | No | Implemented | Draft persistence added in this pass. |
| 57 | `src/components/Dashboard_Manager/Storage/components/ingredients/QuickStockModal.jsx` | Yes | Yes | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 58 | `src/components/Dashboard_Manager/Storage/components/modals/StockInModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 59 | `src/components/Dashboard_Manager/Storage/components/modals/StockOutModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 60 | `src/components/Dashboard_Manager/Storage/components/modals/StockTransferModal.jsx` | Yes | No | No | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 61 | `src/components/Dashboard_Manager/Storage/components/recipes/RecipeDetailModal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 62 | `src/components/Dashboard_Manager/Storage/components/recipes/RecipeDishPickerModal.jsx` | Yes | No | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 63 | `src/components/Dashboard_Manager/Storage/components/recipes/RecipeModal.jsx` | Yes | Yes | No | Implemented | Draft persistence added in this pass. |
| 64 | `src/components/Dashboard_Manager/Storage/components/supplies/SupplyModal.jsx` | Yes | Yes | No | Implemented | Draft persistence added in this pass. |
| 65 | `src/components/Dashboard_Manager/Table/Table3DSimulatorModal.jsx` | Yes | No | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 66 | `src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx` | Yes | No | Yes | Implemented | Draft enabled; close pipeline unified for overlay/ESC/X/Cancel. |
| 67 | `src/components/OrderModal.jsx` | Yes | No | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 68 | `src/components/Staff/components/CartBottomSheet.jsx` | No | No | Yes | Not applicable | View/confirm/info modal; no form draft needed. |
| 69 | `src/components/Staff/components/StaffProofCaptureModal.jsx` | Yes | No | Yes | Deferred | Input modal; deferred to next phase to avoid broad-risk regression. |
| 70 | `src/components/common/Dialog.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 71 | `src/components/common/Modal.jsx` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |
| 72 | `src/components/Dashboard_Manager/Table/TableManagement.jsx` (Add Table modal) | Yes | Yes | No | Implemented | Embedded modal (không tách file riêng) đã bật draft persistence. |
| 73 | `src/components/Dashboard_Manager/Table/TableManagement.jsx` (Add Floor modal) | Yes | Yes | No | Implemented | Embedded modal (không tách file riêng) đã bật draft persistence. |
| 74 | `src/components/Dashboard_Manager/Table/TableManagement.jsx` (Restaurant VR modal) | Yes | Yes | No | Implemented | Embedded modal (không tách file riêng) đã bật draft persistence. |
| 75 | `src/hooks/useModalDraft.js` | No | No | No | Not applicable | View/confirm/info modal; no form draft needed. |

## Implemented draft-enabled modals
- Storage: IngredientModal, SupplyModal, RecipeModal.
- Menu: MenuItemModal, CategoryModal.
- Staff: EmployeeFormModal (create), EmployeeEditModal.
- POS/Order: NewOrderModal, OrderSettingsModal, RegularCustomerModal, ReservationModal, SplitTableModal.
- Table: TableActionsLiteModal.
- Table (embedded in page): Add Table modal, Add Floor modal, Restaurant VR modal.

## Deferred highlights
- POS payment/QR remains deferred for payment-sensitive contexts; customer/reservation forms now rollout with sensitive whitelist.
- Remaining input modals: continue phased migration with shared close pipeline adapter + per-field sensitivity whitelist.
