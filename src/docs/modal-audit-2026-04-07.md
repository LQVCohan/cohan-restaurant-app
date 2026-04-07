# Modal Audit Report (2026-04-07)

## PHẦN 1 — KHẢO SÁT DỰ ÁN
- **Stack thực tế**: Frontend React 19 + Vite + SCSS modules/plain SCSS + Apollo Client; backend Node/Fastify/GraphQL (monorepo chung). Modal hiện diện chủ yếu ở frontend `src/`.  
- **Cơ chế modal đang dùng**:
  - `src/components/common/Modal.jsx` (portal, overlay click close, ESC close, lock body scroll, tiêu đề + close icon dạng compound component).
  - `src/components/common/Dialog.jsx` (custom dialog tối giản: chỉ overlay click close, thiếu ESC/focus trap/aria-role chuẩn).
  - Nhiều modal tự dựng thủ công bằng `createPortal` hoặc `<div className="modal...">` thay vì dùng base modal.
- **File/thư mục liên quan**:
  - `src/components/common/Modal.jsx`, `src/components/common/Dialog.jsx`
  - Các cụm business: `Customer`, `Dashboard_Manager/*`, `Staff`, `Table`, `POS`, `Storage`, `Schedule`, `Promotion`.
- **Pattern modal chung của hệ thống (thực tế quét static)**:
  - Tổng cộng **71** component dạng modal/dialog/popup/bottom-sheet.
  - Chỉ **14/71** dùng `common/Modal`.
  - Chỉ **9/71** có xử lý ESC trong component.
  - Chỉ **3/71** có dấu hiệu overlay click close ở cấp component.
  - **39/71** có disabled state.
  - **25/71** có loading state.
  - **11/71** có dấu hiệu bảo vệ mất dữ liệu (dirty/confirm).

> Ghi chú độ chắc chắn: Audit này là **code audit tĩnh** (đọc mã nguồn + quan hệ tham chiếu), chưa chạy full e2e UI nên các nhận định về focus trap/scroll lock/UX runtime được gắn mức chắc chắn từ trung bình đến cao tùy file.

## PHẦN 2 — DANH SÁCH TOÀN BỘ MODAL

| STT | Tên | File | Mở từ đâu (tham chiếu tĩnh) | Dấu hiệu kỹ thuật |
|---:|---|---|---|---|
| 1 | AddressModal | `src/components/Customer/AddressPage/AddressModal.jsx` | Không tìm thấy tham chiếu trực tiếp (có thể dynamic/chưa dùng) | DisabledState |
| 2 | ModifierModal | `src/components/Customer/BookingDishesModal/ModifierModal.jsx` | src/components/Customer/BookingDishesModal/OrderSummaryModal.jsx:9:import ModifierModal from "./ModifierModal"; | src/components/Customer/BookingDishesModal/OrderSummaryModal.jsx:101:  const [isModifierModalOpen, setIsModifierModalOpen] = useState(false); | BaseModal, DisabledState, LoadingState |
| 3 | OrderSummaryModal | `src/components/Customer/BookingDishesModal/OrderSummaryModal.jsx` | src/pages/CheckoutPage.jsx:3:import OrderSummaryModal from "@/components/Customer/BookingDishesModal/OrderSummaryModal"; | src/pages/CheckoutPage.jsx:22:    <OrderSummaryModal | BaseModal, DisabledState, LoadingState |
| 4 | BookingModal | `src/components/Customer/BookingTableModal/BookingModal.jsx` | src/components/Customer/TableBooking/TableBooking.jsx:9:import BookingModal from "../BookingTableModal/BookingModal"; | src/components/Customer/TableBooking/TableBooking.jsx:57:  const [showBookingModal, setShowBookingModal] = useState(false); | DisabledState, LoadingState |
| 5 | NotifyModal | `src/components/Customer/NotifyModal/NotifyModal.jsx` | src/routes/AppRouter.jsx:55:import NotificationsPage from "@/components/Customer/NotifyModal/NotificationsPage"; | ESC, DisabledState, LoadingState |
| 6 | CancelOrderModal | `src/components/Customer/OrdersManagement/modals/CancelOrderModal.jsx` | src/components/Customer/OrdersManagement/OrdersPage.jsx:12:import CancelOrderModal from "./modals/CancelOrderModal"; | src/components/Customer/OrdersManagement/OrdersPage.jsx:437:      <CancelOrderModal | BaseModal |
| 7 | ChangeTableModal | `src/components/Customer/OrdersManagement/modals/ChangeTableModal.jsx` | src/components/Customer/OrdersManagement/OrdersPage.jsx:16:import ChangeTableModal from "./modals/ChangeTableModal"; | src/components/Customer/OrdersManagement/OrdersPage.jsx:462:      <ChangeTableModal | BaseModal, DisabledState |
| 8 | ChangeTimeModal | `src/components/Customer/OrdersManagement/modals/ChangeTimeModal.jsx` | src/components/Customer/OrdersManagement/OrdersPage.jsx:13:import ChangeTimeModal from "./modals/ChangeTimeModal"; | src/components/Customer/OrdersManagement/OrdersPage.jsx:419:      <ChangeTimeModal | BaseModal |
| 9 | Modals | `src/components/Customer/OrdersManagement/modals/Modals.jsx` | src/components/Dashboard_Manager/Staff/StaffManagement.jsx:31:  const [modals, setModals] = useState({ | src/components/Dashboard_Manager/Staff/StaffManagement.jsx:171:  const openModal = (name) => setModals((prev) => ({ ...prev, [name]: true })); | — |
| 10 | TrackingModal | `src/components/Customer/OrdersManagement/modals/TrackingModal.jsx` | src/components/Customer/OrdersManagement/OrdersPage.jsx:15:import TrackingModal from "./modals/TrackingModal"; | src/components/Customer/OrdersManagement/OrdersPage.jsx:457:      <TrackingModal | BaseModal |
| 11 | QRPaymentModal | `src/components/Customer/QRPaymentModal/QRPaymentModal.jsx` | src/components/Customer/TableBooking/TableBooking.jsx:10:import QRPaymentModal from "../QRPaymentModal/QRPaymentModal"; | src/components/Customer/TableBooking/TableBooking.jsx:309:      <QRPaymentModal | BaseModal, ESC, DisabledState |
| 12 | ProductModal | `src/components/Customer/RestaurantMenu/components/ProductModal.jsx` | Không tìm thấy tham chiếu trực tiếp (có thể dynamic/chưa dùng) | — |
| 13 | SuccessModal | `src/components/Customer/SuccessModal/SuccessModal.jsx` | src/components/Customer/TableBooking/TableBooking.jsx:11:import SuccessModal from "../SuccessModal/SuccessModal"; | src/components/Customer/TableBooking/TableBooking.jsx:59:  const [showSuccessModal, setShowSuccessModal] = useState(false); | BaseModal, ESC |
| 14 | ConfirmationModal | `src/components/Customer/TableBooking/ConfirmationModal/ConfirmationModal.jsx` | src/components/Customer/OrdersManagement/OrdersPage.jsx:17:import ConfirmationModal from "../../Customer/TableBooking/ConfirmationModal/ConfirmationModal"; | src/components/Customer/OrdersManagement/OrdersPage.jsx:448:      <ConfirmationModal | — |
| 15 | AddCustomerModal | `src/components/Dashboard_Manager/Customer/AddCustomerModal.jsx` | src/components/Dashboard_Manager/Customer/CustomerManagement.jsx:22:import AddCustomerModal from "./AddCustomerModal"; | src/components/Dashboard_Manager/Customer/CustomerManagement.jsx:504:        <AddCustomerModal onClose={() => setShowAddModal(false)} /> | BaseModal, ESC, DisabledState |
| 16 | CustomerModal | `src/components/Dashboard_Manager/Customer/CustomerModal.jsx` | src/hooks/useUserManagement.js:324:/* NEW: mutation dùng riêng cho CustomerModal để đồng bộ điểm & phân hạng */ | src/hooks/useUserManagement.js:513:  // NEW: mutation chuyên cập nhật loyaltyPoints + customerType (được CustomerModal dùng thẳng) | BaseModal |
| 17 | OrderBillModal | `src/components/Dashboard_Manager/Customer/OrderBillModal.jsx` | Không tìm thấy tham chiếu trực tiếp (có thể dynamic/chưa dùng) | Portal |
| 18 | PromotionModal | `src/components/Dashboard_Manager/Customer/PromotionModal.jsx` | src/components/Dashboard_Manager/Menu/components/PromotionModal/PromotionModal.jsx:14:import "./PromotionModal.scss"; | src/components/Dashboard_Manager/Menu/components/PromotionModal/PromotionModal.jsx:16:const PromotionModal = ({ isOpen, onSave, onClose, menuItems = [] }) => { | BaseModal, DisabledState |
| 19 | CategoryModal | `src/components/Dashboard_Manager/Menu/components/CategoryModal/CategoryModal.jsx` | src/components/Dashboard_Manager/Menu/MenuManagement.jsx:18:import CategoryModal from "./components/CategoryModal/CategoryModal"; | src/components/Dashboard_Manager/Menu/MenuManagement.jsx:423:      <CategoryModal | DisabledState, LoadingState, DirtyGuard? |
| 20 | MenuItemModal | `src/components/Dashboard_Manager/Menu/components/MenuItemModal/MenuItemModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:22:// │   ├─ MenuItemModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:554:export function MenuItemModal() { return null; } | DisabledState, LoadingState |
| 21 | MenuModal | `src/components/Dashboard_Manager/Menu/components/MenuModal/MenuModal.jsx` | src/components/Dashboard_Manager/Menu/MenuManagement.jsx:20:import MenuModal from "./components/MenuModal/MenuModal"; | src/components/Dashboard_Manager/Menu/MenuManagement.jsx:398:      <MenuModal | DisabledState, LoadingState, DirtyGuard? |
| 22 | PriceEditModal | `src/components/Dashboard_Manager/Menu/components/PriceEditModal/PriceEditModal.jsx` | src/components/Dashboard_Manager/Menu/MenuManagement.jsx:19:import PriceEditModal from "./components/PriceEditModal/PriceEditModal"; | src/components/Dashboard_Manager/Menu/MenuManagement.jsx:431:      <PriceEditModal | DisabledState, DirtyGuard? |
| 23 | PromotionModal | `src/components/Dashboard_Manager/Menu/components/PromotionModal/PromotionModal.jsx` | src/components/Dashboard_Manager/Customer/CustomerManagement.jsx:20:import PromotionModal from "./PromotionModal"; | src/components/Dashboard_Manager/Customer/CustomerManagement.jsx:135:  const [showPromotionModal, setShowPromotionModal] = useState(false); | — |
| 24 | HistoryModal | `src/components/Dashboard_Manager/Order/components/HistoryModal.jsx` | src/components/Dashboard_Manager/Staff/StaffManagement.jsx:12:  WorkHistoryModal, | src/components/Dashboard_Manager/Staff/StaffManagement.jsx:285:      <WorkHistoryModal | LoadingState |
| 25 | ItemModal | `src/components/Dashboard_Manager/Order/components/ItemModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:22:// │   ├─ MenuItemModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:554:export function MenuItemModal() { return null; } | LoadingState |
| 26 | NewOrderModal | `src/components/Dashboard_Manager/Order/components/NewOrderModal.jsx` | src/components/Dashboard_Manager/Order/OrderManagement.jsx:33:import NewOrderModal from "./components/NewOrderModal"; | src/components/Dashboard_Manager/Order/OrderManagement.jsx:148:  const [showNewOrderModal, setShowNewOrderModal] = useState(false); | BaseModal, DisabledState, LoadingState |
| 27 | OrderModal | `src/components/Dashboard_Manager/Order/components/OrderModal.jsx` | src/components/OrderModal.jsx:3:const OrderModal = ({ | src/components/OrderModal.jsx:16:  setShowOrderModal, | Portal, DisabledState, DirtyGuard? |
| 28 | OrderSettingsModal | `src/components/Dashboard_Manager/Order/components/OrderSettingsModal.jsx` | src/components/Dashboard_Manager/Order/OrderManagement.jsx:35:import OrderSettingsModal from "./components/OrderSettingsModal"; | src/components/Dashboard_Manager/Order/OrderManagement.jsx:839:        <OrderSettingsModal | BaseModal |
| 29 | ConfirmDeleteModal | `src/components/Dashboard_Manager/POS/components/modals/ConfirmDeleteModal.jsx` | src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx:16:import ConfirmDeleteModal from "../modals/ConfirmDeleteModal"; | src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx:868:      <ConfirmDeleteModal | DisabledState |
| 30 | ConfirmSaveTakingOrderModal | `src/components/Dashboard_Manager/POS/components/modals/ConfirmSaveTakingOrderModal.jsx` | Không tìm thấy tham chiếu trực tiếp (có thể dynamic/chưa dùng) | Portal, DisabledState |
| 31 | MenuItemModal | `src/components/Dashboard_Manager/POS/components/modals/MenuItemModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:22:// │   ├─ MenuItemModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:554:export function MenuItemModal() { return null; } | DisabledState, LoadingState |
| 32 | OrderConfirmModal | `src/components/Dashboard_Manager/POS/components/modals/OrderConfirmModal.jsx` | src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx:18:import OrderConfirmModal from "../modals/OrderConfirmModal"; | src/components/Dashboard_Manager/POS/components/pos/RightPanel.jsx:889:      <OrderConfirmModal | ESC, DisabledState |
| 33 | PaymentModal | `src/components/Dashboard_Manager/POS/components/modals/PaymentModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:23:// │   ├─ PaymentModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:555:export function PaymentModal() { return null; } | DisabledState, LoadingState |
| 34 | PrintModal | `src/components/Dashboard_Manager/POS/components/modals/PrintModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:28:// │   ├─ PrintModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:560:export function PrintModal() { return null; } | — |
| 35 | PrintQueueModal | `src/components/Dashboard_Manager/POS/components/modals/PrintQueueModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:29:// │   ├─ PrintQueueModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:561:export function PrintQueueModal() { return null; } | — |
| 36 | PrinterSettingsModal | `src/components/Dashboard_Manager/POS/components/modals/PrinterSettingsModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:30:// │   └─ PrinterSettingsModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:562:export function PrinterSettingsModal() { return null; } | DisabledState, LoadingState |
| 37 | ReceiptModal | `src/components/Dashboard_Manager/POS/components/modals/ReceiptModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:24:// │   ├─ ReceiptModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:556:export function ReceiptModal() { return null; } | — |
| 38 | RegularCustomerModal | `src/components/Dashboard_Manager/POS/components/modals/RegularCustomerModal.jsx` | src/components/Dashboard_Manager/POS/components/pos/LeftPanel.jsx:5:import RegularCustomerModal from "../modals/RegularCustomerModal"; | src/components/Dashboard_Manager/POS/components/pos/LeftPanel.jsx:747:      <RegularCustomerModal | DisabledState, LoadingState, DirtyGuard? |
| 39 | ReservationModal | `src/components/Dashboard_Manager/POS/components/modals/ReservationModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:25:// │   ├─ ReservationModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:557:export function ReservationModal() { return null; } | — |
| 40 | SplitTableModal | `src/components/Dashboard_Manager/POS/components/modals/SplitTableModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:26:// │   ├─ SplitTableModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:558:export function SplitTableModal() { return null; } | — |
| 41 | SwitchTableConfirmModal | `src/components/Dashboard_Manager/POS/components/modals/SwitchTableConfirmModal.jsx` | Không tìm thấy tham chiếu trực tiếp (có thể dynamic/chưa dùng) | — |
| 42 | TableActionsModal | `src/components/Dashboard_Manager/POS/components/modals/TableActionsModal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:27:// │   ├─ TableActionsModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:559:export function TableActionsModal() { return null; } | Portal, ESC, DisabledState, LoadingState, DirtyGuard? |
| 43 | PromotionModal | `src/components/Dashboard_Manager/Promotion/components/PromotionModal/PromotionModal.jsx` | src/components/Dashboard_Manager/Promotion/PromotionManagement.jsx:22:import PromotionModal from "./components/PromotionModal/PromotionModal"; | src/components/Dashboard_Manager/Promotion/PromotionManagement.jsx:797:        <PromotionModal | OverlayClose |
| 44 | VoucherModal | `src/components/Dashboard_Manager/Promotion/components/VoucherModal/VoucherModal.jsx` | src/components/Dashboard_Manager/Promotion/PromotionManagement.jsx:23:import VoucherModal from "./components/VoucherModal/VoucherModal"; | src/components/Dashboard_Manager/Promotion/PromotionManagement.jsx:68:  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false); | — |
| 45 | VoucherPackageModal | `src/components/Dashboard_Manager/Promotion/components/VoucherPackageModal/VoucherPackageModal.jsx` | src/components/Dashboard_Manager/Promotion/PromotionManagement.jsx:24:import VoucherPackageModal from "./components/VoucherPackageModal/VoucherPackageModal"; | src/components/Dashboard_Manager/Promotion/PromotionManagement.jsx:813:        <VoucherPackageModal | — |
| 46 | ReviewModal | `src/components/Dashboard_Manager/Review/components/ReviewModal.jsx` | src/components/Dashboard_Manager/Review/ReviewManagement.jsx:10:import ReviewModal from "./components/ReviewModal"; | src/components/Dashboard_Manager/Review/ReviewManagement.jsx:433:      <ReviewModal | DisabledState, LoadingState |
| 47 | AddShiftModal | `src/components/Dashboard_Manager/Schedule/components/AddShiftModal.jsx` | src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx:23:import AddShiftModal from "./components/AddShiftModal"; | src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx:282:  const openAddShiftModal = (dateObj, shiftType) => { | — |
| 48 | AutoScheduleModal | `src/components/Dashboard_Manager/Schedule/components/AutoScheduleModal.jsx` | Không tìm thấy tham chiếu trực tiếp (có thể dynamic/chưa dùng) | — |
| 49 | ShiftDetailModal | `src/components/Dashboard_Manager/Schedule/components/ShiftDetailModal.jsx` | src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx:24:import ShiftDetailModal from "./components/ShiftDetailModal"; | src/components/Dashboard_Manager/Schedule/ScheduleManagement.jsx:537:      <ShiftDetailModal | DirtyGuard? |
| 50 | EmployeeEditModal | `src/components/Dashboard_Manager/Staff/components/modals/EmployeeEditModal/EmployeeEditModal.jsx` | src/components/Dashboard_Manager/Staff/components/modals/index.js:2:export { default as EditEmployeeModal } from "./EmployeeEditModal/EmployeeEditModal"; | DisabledState, LoadingState |
| 51 | EmployeeFormModal | `src/components/Dashboard_Manager/Staff/components/modals/EmployeeFormModal/EmployeeFormModal.jsx` | src/components/Dashboard_Manager/Staff/components/modals/index.js:1:export { default as AddEmployeeModal } from "./EmployeeFormModal/EmployeeFormModal"; | DisabledState, LoadingState, DirtyGuard? |
| 52 | WorkHistoryModal | `src/components/Dashboard_Manager/Staff/components/modals/WorkHistoryModal/WorkHistoryModal.jsx` | src/components/Dashboard_Manager/Staff/StaffManagement.jsx:12:  WorkHistoryModal, | src/components/Dashboard_Manager/Staff/StaffManagement.jsx:285:      <WorkHistoryModal | DisabledState, LoadingState |
| 53 | AllocationModal | `src/components/Dashboard_Manager/Storage/components/allocation/AllocationModal.jsx` | src/components/Dashboard_Manager/Storage/components/allocation/AllocationList.jsx:4:import AllocationModal from "./AllocationModal"; | src/components/Dashboard_Manager/Storage/components/allocation/AllocationList.jsx:183:      <AllocationModal | DisabledState |
| 54 | IngredientCategoryManagerModal | `src/components/Dashboard_Manager/Storage/components/ingredients/IngredientCategoryManagerModal.jsx` | src/components/Dashboard_Manager/Storage/components/ingredients/IngredientList.jsx:15:import IngredientCategoryManagerModal from "./IngredientCategoryManagerModal"; | src/components/Dashboard_Manager/Storage/components/ingredients/IngredientList.jsx:366:      <IngredientCategoryManagerModal | DisabledState, LoadingState, DirtyGuard? |
| 55 | IngredientModal | `src/components/Dashboard_Manager/Storage/components/ingredients/IngredientModal.jsx` | src/components/Dashboard_Manager/Storage/components/ingredients/IngredientList.jsx:13:import IngredientModal from "./IngredientModal"; | src/components/Dashboard_Manager/Storage/components/ingredients/IngredientList.jsx:316:      <IngredientModal | DisabledState |
| 56 | QuickStockModal | `src/components/Dashboard_Manager/Storage/components/ingredients/QuickStockModal.jsx` | src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx:18:import QuickStockModal from "../ingredients/QuickStockModal"; | src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx:310:        <QuickStockModal | DisabledState |
| 57 | StockInModal | `src/components/Dashboard_Manager/Storage/components/modals/StockInModal.jsx` | Không tìm thấy tham chiếu trực tiếp (có thể dynamic/chưa dùng) | DisabledState |
| 58 | StockOutModal | `src/components/Dashboard_Manager/Storage/components/modals/StockOutModal.jsx` | src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx:16:import StockOutModal from "../modals/StockOutModal"; | src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx:330:        <StockOutModal | DisabledState |
| 59 | StockTransferModal | `src/components/Dashboard_Manager/Storage/components/modals/StockTransferModal.jsx` | src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx:17:import StockTransferModal from "../modals/StockTransferModal"; | src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx:338:        <StockTransferModal | DisabledState |
| 60 | RecipeDetailModal | `src/components/Dashboard_Manager/Storage/components/recipes/RecipeDetailModal.jsx` | src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx:15:import RecipeDetailModal from "./RecipeDetailModal"; | src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx:364:      <RecipeDetailModal | — |
| 61 | RecipeDishPickerModal | `src/components/Dashboard_Manager/Storage/components/recipes/RecipeDishPickerModal.jsx` | src/components/Dashboard_Manager/Storage/components/recipes/RecipeModal.jsx:19:import RecipeDishPickerModal from "./RecipeDishPickerModal"; | src/components/Dashboard_Manager/Storage/components/recipes/RecipeModal.jsx:2058:      <RecipeDishPickerModal | Portal, ESC |
| 62 | RecipeModal | `src/components/Dashboard_Manager/Storage/components/recipes/RecipeModal.jsx` | src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx:14:import RecipeModal from "./RecipeModal"; | src/components/Dashboard_Manager/Storage/components/recipes/RecipeList.jsx:350:      <RecipeModal | DisabledState, LoadingState, DirtyGuard? |
| 63 | SupplyModal | `src/components/Dashboard_Manager/Storage/components/supplies/SupplyModal.jsx` | src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx:13:import SupplyModal from "./SupplyModal"; | src/components/Dashboard_Manager/Storage/components/supplies/SupplyList.jsx:302:        <SupplyModal | — |
| 64 | Table3DSimulatorModal | `src/components/Dashboard_Manager/Table/Table3DSimulatorModal.jsx` | src/components/Dashboard_Manager/Table/TableManagement.jsx:11:import Table3DSimulatorModal from "./Table3DSimulatorModal"; | src/components/Dashboard_Manager/Table/TableManagement.jsx:636:      <Table3DSimulatorModal | BaseModal, DisabledState, LoadingState |
| 65 | TableActionsLiteModal | `src/components/Dashboard_Manager/Table/TableActionsLiteModal.jsx` | src/components/Dashboard_Manager/Table/TableManagement.jsx:10:import TableActionsLiteModal from "./TableActionsLiteModal"; | src/components/Dashboard_Manager/Table/TableManagement.jsx:512:        <TableActionsLiteModal | Portal, ESC, DisabledState, LoadingState, DirtyGuard? |
| 66 | OrderModal | `src/components/OrderModal.jsx` | src/components/TableLayout.jsx:5:import OrderModal from "./OrderModal"; | src/components/TableLayout.jsx:13:  const [showOrderModal, setShowOrderModal] = useState(false); | OverlayClose |
| 67 | CartBottomSheet | `src/components/Staff/components/CartBottomSheet.jsx` | src/components/Staff/StaffOrdering.jsx:28:import CartBottomSheet from "./components/CartBottomSheet"; | src/components/Staff/StaffOrdering.jsx:938:        <CartBottomSheet | DisabledState |
| 68 | StaffProofCaptureModal | `src/components/Staff/components/StaffProofCaptureModal.jsx` | src/components/Staff/StaffOrdering.jsx:33:import StaffProofCaptureModal from "./components/StaffProofCaptureModal"; | src/components/Staff/StaffOrdering.jsx:949:      <StaffProofCaptureModal | DisabledState, LoadingState |
| 69 | Dialog | `src/components/common/Dialog.jsx` | Không tìm thấy tham chiếu trực tiếp (có thể dynamic/chưa dùng) | OverlayClose |
| 70 | Modal | `src/components/common/Modal.jsx` | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:22:// │   ├─ MenuItemModal.jsx | src/data/food_hub_pos_react_scss_modules_refactor_package.jsx:23:// │   ├─ PaymentModal.jsx | Portal, ESC |
| 71 | VerifyEmailConfirm | `src/pages/VerifyEmailConfirm.jsx` | src/routes/AppRouter.jsx:18:import VerifyEmailConfirm from "../pages/VerifyEmailConfirm"; | src/routes/AppRouter.jsx:136:      <Route path="/verify-email/confirm" element={<VerifyEmailConfirm />} /> | LoadingState |

## PHẦN 3 — AUDIT CHI TIẾT TỪNG MODAL

### 3.1 Kết luận chi tiết theo nhóm modal (đầy đủ phạm vi 71 component)

#### Nhóm A — Dùng `common/Modal` (ưu tiên đúng chuẩn hơn)
`ModifierModal`, `OrderSummaryModal`, `CancelOrderModal`, `ChangeTableModal`, `ChangeTimeModal`, `TrackingModal`, `QRPaymentModal`, `SuccessModal`, `AddCustomerModal`, `CustomerModal`, `PromotionModal` (Customer), `NewOrderModal`, `OrderSettingsModal`, `Table3DSimulatorModal`.
- **Mục đích nghiệp vụ**: đa số đúng (create/edit/confirm/detail).
- **Core feature**: có khung modal chuẩn, title/body/footer tương đối nhất quán.
- **Thiếu nghiệp vụ thường gặp**: dirty guard không đồng đều; một số modal chỉ xử lý happy path.
- **Thiếu hành vi modal chuẩn**: phụ thuộc `common/Modal` nên **chưa có focus trap thực thụ** và **chưa trả focus rõ ràng** về phần tử mở trước đó.
- **Rủi ro UX**: Trung bình (đặc biệt form dài có thể mất dữ liệu nếu đóng ngoài ý muốn ở modal không có dirty-check).
- **Rủi ro kỹ thuật**: Trung bình.
- **Mức độ**: `Thiếu nhẹ` đến `Thiếu quan trọng` tùy modal form nhập liệu.
- **Đề xuất sửa cụ thể**: chuẩn hóa guard `onCloseAttempt`, bổ sung focus trap + restore focus ở `common/Modal` để fix diện rộng.

#### Nhóm B — Tự dựng modal thủ công (không dùng base modal)
Bao gồm phần lớn modal ở Menu/POS/Storage/Schedule/Promotion/Order cũ.
- **Mục đích nghiệp vụ**: đa dạng (thêm/sửa/xóa/chọn dữ liệu/in/thu tiền/chia bàn/chuyển bàn/xem lịch sử).
- **Core feature**: nhiều modal đạt UI shell nhưng không đồng đều behavior.
- **Thiếu nghiệp vụ thường gặp**:
  1. submit chưa khóa đủ trạng thái khi đang gọi API;
  2. thiếu thông báo lỗi backend có cấu trúc;
  3. thiếu xác nhận mất dữ liệu khi đóng lúc đang nhập.
- **Thiếu modal-standard** thường gặp:
  - không có ESC;
  - không có overlay close policy rõ ràng;
  - thiếu aria role/label;
  - thiếu focus trap;
  - thiếu restore focus.
- **Rủi ro UX**: Cao hơn nhóm A do behavior không nhất quán giữa các màn.
- **Rủi ro kỹ thuật**: Trung bình-cao (state leak khi mở lần 2 nếu không reset form đầy đủ).
- **Mức độ**: `Thiếu quan trọng` rải rác; chưa thấy lỗi crash hàng loạt qua static audit.
- **Đề xuất sửa cụ thể**: di chuyển dần về `common/Modal` hoặc tạo `ModalAdapter` chuẩn hóa API đóng/mở/a11y.

#### Nhóm C — Confirm/Destructive modals
`ConfirmDeleteModal`, `SwitchTableConfirmModal`, `OrderConfirmModal`, `CancelOrderModal`, `ConfirmationModal`.
- **Mục đích nghiệp vụ**: đúng loại hành động nguy hiểm/xác nhận cuối.
- **Thiếu nghiệp vụ**: một số wording chưa đủ mạnh theo ngữ cảnh mất dữ liệu/không thể hoàn tác.
- **Thiếu modal-standard**: không đồng nhất ESC/overlay policy (confirm nguy hiểm nên thường cần chặn overlay-close hoặc xác nhận lại).
- **Rủi ro UX**: Cao nếu người dùng đóng nhầm khi đang thao tác.
- **Mức độ**: `Thiếu quan trọng` (đặc biệt thao tác xóa/chuyển bàn/chốt đơn).

#### Nhóm D — Modal liên quan upload/chụp ảnh/chứng từ
`StaffProofCaptureModal`, một số modal POS/Payment/Receipt có luồng dữ liệu quan trọng.
- **Mục đích nghiệp vụ**: đúng.
- **Thiếu nghiệp vụ**: cần xử lý rõ khi đang upload/chụp mà đóng modal (warning + cleanup + retry).
- **Rủi ro mất dữ liệu**: cao nếu đóng đột ngột.
- **Mức độ**: `Thiếu quan trọng`.

### 3.2 Điểm kiểm tra bắt buộc từng modal (trạng thái tổng hợp)
- **Đúng mục đích nghiệp vụ**: ~80% đạt mức Đạt/Thiếu nhẹ.
- **Đủ tính năng cốt lõi**: nhiều modal chỉ đạt mức Thiếu nhẹ đến Thiếu quan trọng do thiếu trạng thái lỗi/loading đồng bộ.
- **Mở/đóng hợp lý**: chưa nhất quán toàn hệ thống (ESC/overlay/policy đóng).
- **An toàn dữ liệu nhập liệu**: còn thiếu dirty-state guard ở nhiều form modal.
- **UX + accessibility**: là nhóm thiếu lớn nhất (focus trap, keyboard order, aria).
- **Ổn định kỹ thuật**: trung bình; rủi ro state leak ở các modal tự dựng không reset toàn bộ.

## PHẦN 4 — TỔNG HỢP VẤN ĐỀ THEO NHÓM
- **Mở/đóng**: pattern phân mảnh; nhiều modal không định nghĩa rõ overlay/ESC policy.
- **Mất dữ liệu nhập liệu**: không đồng đều dirty-check; có nguy cơ đóng mất form.
- **Validation**: có xuất hiện nhưng chưa chuẩn hóa thông điệp lỗi + ngữ cảnh field.
- **Loading/error state**: còn modal thiếu disabled khi submit hoặc thiếu báo lỗi API chi tiết.
- **Accessibility**: thiếu focus trap/restore focus/aria-consistency là vấn đề lớn nhất.
- **Responsive**: do tự dựng nhiều biến thể nên nguy cơ lệch layout cao trên màn nhỏ.
- **Performance**: modal lớn có nguy cơ render nặng lần mở đầu; chưa thấy tối ưu nhất quán.
- **Thiếu nghiệp vụ**: các modal shell UI còn thiếu edge-case handling (đóng lúc submit/upload).
- **Thiếu thành phần modal chuẩn**: close button, header semantics, keyboard handling không đồng đều.

## PHẦN 5 — KẾ HOẠCH SỬA AN TOÀN
1. **Sửa nền tảng trước (ảnh hưởng rộng, rủi ro thấp-trung bình)**
   - File dự định sửa: `src/components/common/Modal.jsx`, `src/components/common/Dialog.jsx`.
   - Lý do: chuẩn hóa hành vi a11y + mở/đóng cho nhiều modal dùng chung.
   - Ảnh hưởng: rộng nhưng kiểm soát được qua test snapshot + keyboard test.
   - Giảm rủi ro: thêm prop opt-in (`trapFocus`, `restoreFocus`, `preventCloseWhenDirty`) trước khi bật mặc định.
2. **Sửa modal có rủi ro dữ liệu cao**
   - Ưu tiên: nhóm form dài và nhóm payment/order/recipe/staff proof.
   - Thêm `onBeforeClose` để chặn đóng khi `isSubmitting/isUploading`.
3. **Chuẩn hóa confirm/destructive wording**
   - Tập trung modal xóa/chuyển/chốt có hậu quả nghiệp vụ.
4. **Phần chỉ nên đề xuất, chưa sửa ngay**
   - Refactor lớn toàn bộ modal thủ công -> base modal (nên làm theo phase để tránh regression).

## PHẦN 6 — CHECKLIST TEST SAU KHI SỬA
- [ ] mở modal
- [ ] đóng modal
- [ ] đóng bằng nút X
- [ ] đóng bằng nút Cancel
- [ ] đóng bằng overlay
- [ ] đóng bằng ESC
- [ ] nhập liệu dở dang rồi click ra ngoài
- [ ] nhập liệu dở dang rồi bấm ESC
- [ ] submit thành công
- [ ] submit lỗi
- [ ] loading state
- [ ] disabled state
- [ ] double click submit
- [ ] reset dữ liệu khi mở lại
- [ ] preload dữ liệu edit
- [ ] responsive
- [ ] keyboard navigation
- [ ] focus trap
- [ ] scroll lock
- [ ] z-index
- [ ] nhiều modal cùng lúc (nếu hỗ trợ)

## CẬP NHẬT TRIỂN KHAI (2026-04-07, vòng 2)
- Đã kiểm tra và vá thêm modal quản lý danh mục nguyên liệu `IngredientCategoryManagerModal`:
  - reset state khi mở modal mới,
  - chặn đóng khi đang loading,
  - confirm khi có dữ liệu nhập dở (`name`),
  - thêm `onBeforeClose` + `closeOnEscape={!loading}`,
  - thêm hiển thị lỗi thao tác create/rename/delete/sync để tránh fail im lặng.

## BỔ SUNG KIỂM TRA TOÀN HỆ THỐNG THEO KEYWORD (vòng 3)
- Quét toàn bộ mã nguồn theo keyword `modal|dialog|drawer|popup|bottomsheet` cho file `jsx/tsx/js/ts/scss/css`:
  - 1513 keyword-hits,
  - 189 files unique có liên quan keyword,
  - 108 file `jsx/tsx` có logic liên quan modal,
  - trong đó 70 file là component có tên modal/dialog/drawer/popup/bottom-sheet rõ ràng,
  - phần còn lại là file mở modal (container/page/management) hoặc style/supporting files.
- Kết luận coverage:
  - Inventory ở **PHẦN 2** đã bao phủ nhóm component modal chính (theo tên file modal-like).
  - Nhóm file keyword còn lại (không phải modal component) chủ yếu là điểm mở modal, state toggle, hoặc style.
  - Modal `IngredientCategoryManagerModal` đã được đưa vào nhánh fix ưu tiên vì là modal nghiệp vụ create/update/delete danh mục nguyên liệu.
