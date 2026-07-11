import React, { Suspense, lazy, useState, useEffect, useMemo, useContext } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Dashboard_Manager/Sidebar";
import Header from "../components/Dashboard_Manager/Header";
import "./ManagerLayout.scss";
import "./ManagerUnifiedBackground.css";
import "../components/Dashboard_Manager/Customer/AiChatbotAdminDashboardScale.scss";
import { AuthContext } from "@/context/AuthContext";
import { isAccountantRole, isHrRole, isManagerRole, isAdminRole } from "@/utils/frontendRoleAccess";
import { filterNavigationByPermissionAccess } from "@/utils/frontendPermissionAccess";
import useManagerRestaurantSelection from "@/hooks/useManagerRestaurantSelection";
import useCommunication from "@/hooks/useCommunication";

const Dashboard = lazy(() => import("../components/Dashboard_Manager/Dashboard"));
const ManagerAnalyst = lazy(() => import("../components/Dashboard_Manager/Analyst/ManagerAnalyst"));
const ReportsManagement = lazy(() => import("../components/Dashboard_Manager/Reports/ReportsManagement"));
const StaffManagement = lazy(() => import("../components/Dashboard_Manager/Staff/StaffManagement"));
const ScheduleManagementPage = lazy(() => import("../components/Dashboard_Manager/Schedule/ScheduleManagementPage"));
const OrderManagement = lazy(() => import("../components/Dashboard_Manager/Order/OrderManagement"));
const MenuManagement = lazy(() => import("../components/Dashboard_Manager/Menu/MenuManagement"));
const ComboManagement = lazy(() => import("../components/Dashboard_Manager/Combo/ComboManagement"));
const ModifierManagement = lazy(() => import("../components/Dashboard_Manager/Modifier/ModifierManagement"));
const TableManagement = lazy(() => import("../components/Dashboard_Manager/Table/TableManagementSettingsEntry"));
const TableTypeManagementPage = lazy(() => import("../components/Dashboard_Manager/Table/TableTypeManagementPage"));
const TableQrManagementPage = lazy(() => import("../components/Dashboard_Manager/Table/TableQrManagementPage"));
const CustomerManagement = lazy(() => import("../components/Dashboard_Manager/Customer/CustomerManagement"));
const CustomerAnalyticsPage = lazy(() => import("../components/Dashboard_Manager/Customer/CustomerAnalyticsPage"));
const AiChatbotAnalyticsPage = lazy(() => import("../components/Dashboard_Manager/Customer/AiChatbotAnalyticsPage"));
const AiChatbotSettingsPage = lazy(() => import("../components/Dashboard_Manager/Customer/AiChatbotSettingsPage"));
const AiChatbotKnowledgePage = lazy(() => import("../components/Dashboard_Manager/Customer/AiChatbotKnowledgePage"));
const PromotionManagement = lazy(() => import("../components/Dashboard_Manager/Promotion/PromotionManagement"));
const PayrollManagement = lazy(() => import("../components/Dashboard_Manager/PayrollPage/PayrollManagement"));
const StorageManagement = lazy(() => import("../components/Dashboard_Manager/Storage/StorageManagement"));
const ReviewManagement = lazy(() => import("../components/Dashboard_Manager/Review/ReviewManagement"));
const FinanceDashboard = lazy(() => import("@/components/Dashboard_Manager/Finance/FinanceDashboard"));
const TransactionManagement = lazy(() => import("@/components/Dashboard_Manager/Transactions/TransactionManagement"));
const TransferPaymentReviewPage = lazy(() => import("@/components/Dashboard_Manager/Transactions/TransferPaymentReviewPage"));
const ManagerWalletPage = lazy(() => import("@/components/Dashboard_Manager/Wallet/ManagerWalletPage"));
const PaymentProviderSettingsPage = lazy(() => import("@/components/Dashboard_Manager/PaymentSettings/PaymentProviderSettingsPage"));
const PrintManagement = lazy(() => import("@/components/Dashboard_Manager/PrintManagement/PrintManagement"));
const RbacManagement = lazy(() => import("@/components/Dashboard_Manager/RBAC/RbacManagement"));
const SettingsManagement = lazy(() => import("@/components/Dashboard_Manager/Settings/SettingsManagement"));
const BackupManagement = lazy(() => import("@/components/Dashboard_Manager/Backup/BackupManagement"));
const SystemUserManagement = lazy(() => import("@/components/Dashboard_Manager/SystemUsers/SystemUserManagement"));
const ManagerRestaurantInfoManagement = lazy(() => import("@/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx").then((module) => ({ default: module.ManagerRestaurantInfoManagement })));
const RestaurantPublicationControl = lazy(() => import("@/components/Dashboard_Manager/RestaurantInfo/RestaurantPublicationControl.jsx"));
const AiHandoffInbox = lazy(() => import("@/components/communication/AiHandoffInbox"));
const BrandManagement = lazy(() => import("@/components/Dashboard_Manager/Brand/BrandManagement.jsx"));
const SystemLogsPage = lazy(() => import("@/components/Dashboard_Manager/SystemLogs/SystemLogsPage"));

const MANAGER_CANONICAL_PATH = "/manager";
const TABLE_SETTINGS_ACTION = "table-types";
const BACKUP_PAGE_PERMISSIONS = ["backup.read", "backup.write", "backup.export", "backup.import", "system.manage"];
const LOG_PAGE_PERMISSIONS = ["log.read", "admin.audit.read", "system.manage", "menu.audit.read"];
const IS_TEST_ENV = import.meta.env.MODE === "test";

const VALID_MANAGER_PAGES = new Set([
  "dashboard", "brands", "tables", "table-qr", "orders", "menu", "modifiers", "combos", "inventory", "staff", "customers",
  "customer-analytics", "analytics", "transactions", "transfer-review", "payment-settings", "wallet", "reports", "schedules",
  "promotions", "finance", "payroll", "reviews", "settings", "rates", "setting",
  "backup", "logs", "print-management", "restaurant-info-management", "rbac", "system-users", "ai-handoff",
  "ai-chatbot-analytics", "ai-chatbot-settings", "ai-chatbot-knowledge",
]);

const normalizeManagerDestination = (pageId) =>
  pageId === TABLE_SETTINGS_ACTION ? "tables" : pageId;

const isKnownManagerDestination = (pageId) =>
  pageId === TABLE_SETTINGS_ACTION || VALID_MANAGER_PAGES.has(pageId);

const resolveInitialManagerPage = () => {
  const hash = window.location.hash?.replace("#", "");
  if (hash && isKnownManagerDestination(hash)) return normalizeManagerDestination(hash);
  const saved = localStorage.getItem("manager.currentPage");
  if (saved && isKnownManagerDestination(saved)) return normalizeManagerDestination(saved);
  return "dashboard";
};

const buildManagerNavigationUrl = ({ page, query = {} }) => {
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });
  const search = params.toString() ? `?${params.toString()}` : "";
  return `${MANAGER_CANONICAL_PATH}${search}#${page}`;
};

const MANAGER_PAGE_PERMISSION_ACCESS = {
  dashboard: ["dashboard.read", "report.read"],
  brands: ["restaurant.read", "restaurant.write", "system.manage"],
  analytics: ["report.read"],
  orders: ["order.read"],
  menu: ["menu.read"],
  modifiers: ["menu.read"],
  combos: ["menu.read"],
  inventory: ["inventory.read", "stock.read"],
  tables: ["table.read"],
  [TABLE_SETTINGS_ACTION]: ["table.write"],
  "table-qr": ["table.read"],
  "restaurant-info-management": ["restaurant.read"],
  staff: ["staff.read"],
  schedules: ["shift.read"],
  payroll: ["payroll.read"],
  customers: ["customer.read"],
  "customer-analytics": ["report.read"],
  promotions: ["promotion.read", "coupon.read"],
  reviews: ["review.read", "report.read"],
  reports: ["report.read"],
  finance: ["finance.read", "payment.read"],
  transactions: ["transaction.read", "finance.read", "payment.read"],
  "transfer-review": ["payment.read", "reconciliation.read"],
  "payment-settings": ["payment.read", "payment.write"],
  wallet: ["payment.read", "payment.write", "refund.write"],
  settings: ["system.manage"],
  rates: ["system.manage"],
  setting: ["system.manage"],
  backup: BACKUP_PAGE_PERMISSIONS,
  logs: LOG_PAGE_PERMISSIONS,
  "print-management": ["print.read"],
  rbac: ["role.read", "permission.read", "staff.write"],
  "system-users": ["system.manage"],
  "ai-handoff": ["ai.chatbot.handoff", "ai.chatbot.moderate"],
  "ai-chatbot-analytics": ["ai.chatbot.analytics.read", "ai.chatbot.read"],
  "ai-chatbot-settings": ["ai.chatbot.write"],
  "ai-chatbot-knowledge": ["ai.chatbot.read", "ai.chatbot.write", "ai.chatbot.moderate", "ai.chatbot.evaluate"],
};

const ADMIN_ONLY_MANAGER_PAGES = new Set(["system-users"]);
const page = (title, description, icon, keywords = []) => ({ title, description, icon, keywords });
const PAGE_CONFIG = {
  dashboard: page("Tổng quan", "Tổng quan hiệu suất và số liệu vận hành nhà hàng", "📊", ["overview", "thống kê", "kpi", "doanh thu", "dashboard"]),
  brands: page("Quản lý chuỗi", "Quản lý Brand, chi nhánh và chủ sở hữu", "🏢", ["brand", "chuỗi", "chi nhánh", "owner"]),
  tables: page("Quản lý bàn", "Theo dõi trạng thái bàn, sơ đồ tầng và đặt chỗ", "🪑", ["bàn", "table", "đặt bàn", "sơ đồ"]),
  "table-qr": page("QR truy cập bàn", "Sinh QR để khách quét tại bàn và xem order hiện tại", "📱", ["qr", "bàn", "quét", "order", "khách"]),
  orders: page("Quản lý đơn hàng", "Xử lý đơn tại chỗ, mang đi, giao hàng và thanh toán", "🧾", ["order", "đơn", "timeline", "thanh toán"]),
  menu: page("Quản lý menu", "Quản lý món ăn, giá bán, danh mục và trạng thái phục vụ", "🍜", ["món", "menu", "giá", "danh mục"]),
  modifiers: page("Cấu hình tuỳ chọn", "Tạo size, topping và tuỳ chọn áp dụng cho món", "🧩", ["modifier", "topping", "size", "tuỳ chọn"]),
  combos: page("Quản lý combo", "Tạo bundle combo cố định, không trộn với khuyến mãi", "🍱", ["combo", "bundle", "set món"]),
  inventory: page("Quản lý kho", "Theo dõi tồn kho, nhập xuất và cảnh báo nguyên liệu", "📦", ["kho", "inventory", "nguyên liệu", "tồn"]),
  staff: page("Quản lý nhân viên", "Danh sách nhân viên, vai trò, trạng thái và phân công", "👥", ["staff", "nhân viên", "vai trò", "quyền"]),
  customers: page("Quản lý khách hàng", "Thông tin khách, hạng thành viên, điểm và hành vi mua", "🧑‍🤝‍🧑", ["khách hàng", "loyalty", "rank", "điểm"]),
  "customer-analytics": page("Phân tích khách hàng", "Phân tích phân khúc khách, khách quay lại, khách rời bỏ và cohort theo thời gian", "📈", ["analytics", "phân tích", "khách", "insight"]),
  analytics: page("Quản lý kinh doanh", "Theo dõi doanh thu, nhu cầu, menu, nhân sự, khuyến mãi và hiệu suất vận hành", "🧠", ["analyst", "ai", "chiến lược", "dự báo"]),
  reports: page("Báo cáo", "Báo cáo doanh thu, đơn hàng và xuất dữ liệu theo kỳ", "📑", ["report", "báo cáo", "xuất file", "csv"]),
  finance: page("Tài chính", "Theo dõi thu chi, công nợ, hoàn tiền và đối soát", "💰", ["finance", "thu", "chi", "công nợ", "profit"]),
  transactions: page("Giao dịch", "Theo dõi thanh toán, hoàn tiền và đối soát giao dịch", "💳", ["transaction", "giao dịch", "payment", "thanh toán", "refund", "đối soát"]),
  "transfer-review": page("Duyệt chuyển khoản", "Xem bằng chứng chuyển khoản, xác minh hoặc từ chối thanh toán", "🏦", ["transfer", "bank", "chuyển khoản", "xác minh", "duyệt thanh toán"]),
  "payment-settings": page("Cổng thanh toán", "Kết nối tài khoản merchant MoMo và VNPAY cho từng chi nhánh", "🔐", ["payment", "merchant", "momo", "vnpay", "cổng thanh toán"]),
  wallet: page("Ví khách hàng", "Quản lý Cohan Balance, hoàn tiền về ví và điều chỉnh số dư", "👛", ["wallet", "ví", "balance", "refund", "hoàn tiền", "cohan balance"]),
  schedules: page("Lịch làm việc", "Lập ca làm theo ngày/tuần/tháng và phân công nhân sự", "📅", ["schedule", "ca làm", "shift", "lịch"]),
  promotions: page("Khuyến mãi", "Quản lý campaign, coupon, điều kiện và thời gian hiệu lực", "🎁", ["promotion", "coupon", "discount", "khuyến mãi"]),
  payroll: page("Bảng lương", "Tổng hợp công, phụ cấp, thưởng phạt và kỳ lương nhân viên", "💼", ["payroll", "salary", "lương", "thưởng", "khấu trừ"]),
  reviews: page("Đánh giá khách hàng", "Xem đánh giá, phản hồi và kiểm duyệt nội dung review", "⭐", ["review", "đánh giá", "rating", "feedback"]),
  "print-management": page("Quản lý in ấn", "Cấu hình máy in, mẫu in, hàng đợi và gửi lại lệnh in lỗi", "🖨️", ["print", "máy in", "phiếu bếp", "hàng đợi"]),
  "restaurant-info-management": page("Thông tin nhà hàng", "Cập nhật hồ sơ nhà hàng, giờ mở cửa và thông tin liên hệ", "🏪", ["nhà hàng", "restaurant", "địa chỉ", "liên hệ"]),
  rbac: page("Phân quyền nhân viên", "Quản lý vai trò, quyền hạn và gán vai trò cho nhân viên", "🛡️", ["phân quyền", "vai trò", "quyền hạn", "rbac", "nhân viên"]),
  "system-users": page("Quản lý người dùng hệ thống", "Quản lý Admin, Manager và các tài khoản không thuộc nhóm Staff", "👤", ["admin", "manager", "người dùng", "tài khoản", "system user", "khóa tài khoản"]),
  logs: page("Check log", "Theo dõi audit log quản trị và event log vận hành", "🧾", ["log", "audit", "event", "nhật ký", "truy vết"]),
  "ai-handoff": page("Hỗ trợ từ AI", "Tiếp nhận các cuộc trò chuyện cần nhân viên hỗ trợ", "🤖", ["handoff", "chatbot", "support", "hỗ trợ"]),
  "ai-chatbot-analytics": page("Báo cáo Chatbot AI", "Theo dõi chất lượng tư vấn và nhu cầu chuyển nhân viên", "📡", ["ai", "chatbot", "analytics", "handoff"]),
  "ai-chatbot-settings": page("Cài đặt Chatbot AI", "Quản lý lời chào, gợi ý nhanh và chuyển nhân viên", "⚙️", ["ai", "chatbot", "settings", "handoff"]),
  "ai-chatbot-knowledge": page("Tri thức Chatbot AI", "Quản lý tri thức, gợi ý, phản hồi, an toàn và kiểm thử", "📚", ["ai", "chatbot", "knowledge", "faq"]),
  settings: page("Cài đặt hệ thống", "Cấu hình vận hành, phân quyền, in ấn và thông tin nhà hàng", "⚙️", ["settings", "cài đặt", "hệ thống", "cấu hình", "quyền"]),
  rates: page("Cài đặt hệ thống", "Cấu hình vận hành, phân quyền, in ấn và thông tin nhà hàng", "⚙️", ["settings", "cài đặt", "hệ thống", "cấu hình", "quyền"]),
  setting: page("Cài đặt hệ thống", "Cấu hình vận hành, phân quyền, in ấn và thông tin nhà hàng", "⚙️", ["settings", "cài đặt", "hệ thống", "cấu hình", "quyền"]),
  backup: page("Sao lưu & khôi phục", "Sao lưu cấu hình, xem trước thay đổi và khôi phục an toàn", "🗄️", ["backup", "sao lưu", "khôi phục", "export", "cấu hình"]),
};

const toNotificationVisualType = (type) => {
  const value = String(type || "").toLowerCase();
  if (value.includes("reject") || value.includes("warning")) return "warning";
  if (value.includes("approve") || value.includes("applied") || value.includes("completed") || value.includes("success")) return "success";
  if (value.includes("created") || value.includes("pending")) return "primary";
  return "info";
};

const formatNotificationTime = (value) => {
  if (!value) return "Vừa xong";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  return date.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
};

const mapManagerNotification = (notification) => ({
  id: notification.id,
  type: toNotificationVisualType(notification.type),
  title: notification.payload?.title || "Thông báo",
  message: notification.payload?.message || "Có cập nhật mới cần xem.",
  time: formatNotificationTime(notification.createdAt),
  read: Boolean(notification.readAt),
  actionUrl: notification.payload?.actionUrl || "",
});

const ManagerHeaderWithNotifications = (props) => {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useCommunication({ notificationsEnabled: true });
  const mappedNotifications = useMemo(
    () => notifications.map(mapManagerNotification),
    [notifications],
  );

  const handleNotificationSelect = (notification) => {
    if (!notification?.id) return;
    void markNotificationRead?.({ variables: { id: notification.id } });
  };

  const handleMarkAllNotificationsRead = () => {
    void markAllNotificationsRead?.({ variables: {} });
  };

  return (
    <Header
      {...props}
      notifications={mappedNotifications}
      onNotificationSelect={handleNotificationSelect}
      onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
    />
  );
};

const BrandRestaurantSelector = ({ selection }) => {
  const {
    selectedBrandId,
    setSelectedBrandId,
    selectedBrand,
    brandOptions,
    selectedRestaurantId,
    setSelectedRestaurantId,
    selectedRestaurant,
    restaurantOptions,
    hasBrands,
    loading,
  } = selection;

  if (loading && !hasBrands && !restaurantOptions.length) return null;

  return (
    <div className="manager-scope-selector" aria-label="Phạm vi quản lý Brand và chi nhánh">
      <label>
        <span>Chuỗi</span>
        {brandOptions.length > 1 ? (
          <select value={selectedBrandId || ""} onChange={(event) => setSelectedBrandId(event.target.value)}>
            <option value="">Nhà hàng chưa gán chuỗi</option>
            {brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        ) : (
          <strong>{selectedBrand?.name || (hasBrands ? brandOptions[0]?.name : "Nhà hàng chưa gán chuỗi")}</strong>
        )}
      </label>
      <label>
        <span>Chi nhánh</span>
        {restaurantOptions.length > 1 ? (
          <select value={selectedRestaurantId || ""} onChange={(event) => setSelectedRestaurantId(event.target.value)}>
            {restaurantOptions.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
          </select>
        ) : (
          <strong>{selectedRestaurant?.name || "Chưa có chi nhánh"}</strong>
        )}
      </label>
    </div>
  );
};

const PermissionFallback = () => <div className="manager-page-shell__empty">Bạn không có quyền truy cập chức năng này.</div>;
const PageLoadingFallback = () => <div className="manager-page-shell__empty">Đang tải trang quản trị...</div>;

const ManagerLayout = () => {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const brandSelection = useManagerRestaurantSelection();
  const roleName = user?.roleName || user?.role?.slug;
  const isAdminUser = isAdminRole(user) || isAdminRole(roleName);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(resolveInitialManagerPage);
  const [showTableSettings, setShowTableSettings] = useState(false);
  const validPages = useMemo(() => VALID_MANAGER_PAGES, []);
  const requestedRestaurantId = useMemo(
    () => new URLSearchParams(location.search).get("restaurantId") || "",
    [location.search],
  );
  const brandAccessResolved = isAdminUser || !brandSelection.loading;
  const hasBrandManagementAccess = useMemo(() => {
    if (isAdminUser) return true;
    const userId = String(user?.id || user?._id || "");
    return brandSelection.brandOptions.some((brand) => {
      const membershipRole = String(
        brand?.membership?.role || brand?.membershipRole || "",
      ).toLowerCase();
      const ownsBrand = Boolean(
        userId && brand?.ownerId && String(brand.ownerId) === userId,
      );
      return ownsBrand || ["owner", "admin"].includes(membershipRole);
    });
  }, [brandSelection.brandOptions, isAdminUser, user?.id, user?._id]);
  const allowedPages = useMemo(() => {
    const navItems = Object.entries(MANAGER_PAGE_PERMISSION_ACCESS).map(([id, permissions]) => ({ id, permissions }));
    const pageSet = new Set(filterNavigationByPermissionAccess(navItems, user).map((item) => item.id));
    if (!isAdminUser) ADMIN_ONLY_MANAGER_PAGES.forEach((pageId) => pageSet.delete(pageId));
    if (brandAccessResolved && !hasBrandManagementAccess) pageSet.delete("brands");
    return pageSet;
  }, [brandAccessResolved, hasBrandManagementAccess, isAdminUser, user]);

  useEffect(() => {
    if (!requestedRestaurantId) return;
    const targetBrand = brandSelection.brandOptions.find((brand) =>
      (brand.restaurants || []).some((restaurant) => String(restaurant.id || restaurant._id) === requestedRestaurantId),
    );
    if (targetBrand && String(targetBrand.id) !== String(brandSelection.selectedBrandId || "")) {
      brandSelection.setSelectedBrandId(String(targetBrand.id));
    }
    if (requestedRestaurantId !== String(brandSelection.selectedRestaurantId || "")) {
      brandSelection.setSelectedRestaurantId(requestedRestaurantId);
    }
  }, [
    brandSelection.brandOptions,
    brandSelection.selectedBrandId,
    brandSelection.selectedRestaurantId,
    brandSelection.setSelectedBrandId,
    brandSelection.setSelectedRestaurantId,
    requestedRestaurantId,
  ]);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash?.replace("#", "");
      if (!hash || !isKnownManagerDestination(hash)) return;
      const nextPage = normalizeManagerDestination(hash);
      if (nextPage !== hash) {
        history.replaceState(null, "", buildManagerNavigationUrl({ page: nextPage }));
      }
      setShowTableSettings(false);
      setCurrentPage(nextPage);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    if (!validPages.has(currentPage)) return;
    localStorage.setItem("manager.currentPage", currentPage);
    const expectedHash = `#${currentPage}`;
    if (window.location.pathname !== MANAGER_CANONICAL_PATH || window.location.hash !== expectedHash) {
      history.replaceState(null, "", `${MANAGER_CANONICAL_PATH}${expectedHash}`);
    }
  }, [currentPage, validPages]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768 && sidebarOpen) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen]);

  const preferredFallbackPage = useMemo(() => {
    if (isHrRole(roleName)) return "staff";
    if (isAccountantRole(roleName)) return "payroll";
    if (isAdminRole(roleName) || isManagerRole(roleName)) return "dashboard";
    return "dashboard";
  }, [roleName]);

  useEffect(() => {
    if (!brandAccessResolved || allowedPages.has(currentPage)) return;
    const nextPage = allowedPages.has(preferredFallbackPage) ? preferredFallbackPage : [...allowedPages].find((pageId) => validPages.has(pageId)) || "dashboard";
    setShowTableSettings(false);
    setCurrentPage(nextPage);
    setSidebarOpen(false);
    localStorage.setItem("manager.currentPage", nextPage);
    history.replaceState(null, "", buildManagerNavigationUrl({ page: nextPage }));
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [allowedPages, brandAccessResolved, currentPage, preferredFallbackPage, validPages]);

  const openTableSettings = () => {
    if (!allowedPages.has(TABLE_SETTINGS_ACTION)) return;
    setCurrentPage("tables");
    setShowTableSettings(true);
    setSidebarOpen(false);
    localStorage.setItem("manager.currentPage", "tables");
    history.replaceState(null, "", buildManagerNavigationUrl({ page: "tables" }));
  };

  useEffect(() => {
    const handleManagerNavigate = (event) => {
      const pageId = event?.detail?.page;
      const query = event?.detail?.query || {};
      if (!pageId || !validPages.has(pageId) || !allowedPages.has(pageId)) return;
      setShowTableSettings(false);
      setCurrentPage(pageId);
      setSidebarOpen(false);
      localStorage.setItem("manager.currentPage", pageId);
      history.replaceState(null, "", buildManagerNavigationUrl({ page: pageId, query }));
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.dispatchEvent(new CustomEvent("manager:navigation-query", { detail: { page: pageId, query, source: event?.detail?.source || "manager:navigate" } }));
    };
    window.addEventListener("manager:navigate", handleManagerNavigate);
    return () => window.removeEventListener("manager:navigate", handleManagerNavigate);
  }, [allowedPages, validPages]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);
  const handlePageChange = (pageId) => {
    setShowTableSettings(false);
    setCurrentPage(pageId);
  };

  const managerSearchItems = useMemo(
    () => [...VALID_MANAGER_PAGES]
      .filter((id) => PAGE_CONFIG[id] && allowedPages.has(id))
      .map((id) => ({ id, title: PAGE_CONFIG[id].title, description: PAGE_CONFIG[id].description, category: "Điều hướng", icon: PAGE_CONFIG[id].icon || "📍", type: "navigation", keywords: PAGE_CONFIG[id].keywords || [], route: `#${id}` })),
    [allowedPages],
  );

  const headerProps = {
    pageTitle: PAGE_CONFIG[currentPage]?.title || "Trang quản trị",
    onToggleSidebar: toggleSidebar,
    sidebarOpen,
    searchItems: managerSearchItems,
    scopeSelector: <BrandRestaurantSelector selection={brandSelection} />,
    activeBrand: brandSelection.selectedBrand,
    onSelectSearchResult: (item) => {
      if (!item?.id) return;
      handlePageChange(item.id);
      setSidebarOpen(false);
    },
  };

  const renderContent = () => {
    if (currentPage === "brands" && !brandAccessResolved) return <PageLoadingFallback />;
    if (!allowedPages.has(currentPage)) return <PermissionFallback />;
    switch (currentPage) {
      case "dashboard": return <Dashboard />;
      case "brands": return <BrandManagement />;
      case "tables": return <TableManagement onOpenTableSettings={allowedPages.has(TABLE_SETTINGS_ACTION) ? openTableSettings : undefined} />;
      case "table-qr": return <TableQrManagementPage />;
      case "orders": return <OrderManagement />;
      case "menu": return <MenuManagement />;
      case "modifiers": return <ModifierManagement key={brandSelection.selectedRestaurantId || "no-restaurant"} />;
      case "combos": return <ComboManagement />;
      case "inventory": return <StorageManagement />;
      case "staff": return <StaffManagement />;
      case "customers": return <CustomerManagement />;
      case "customer-analytics": return <CustomerAnalyticsPage />;
      case "analytics": return <ManagerAnalyst />;
      case "reports": return <ReportsManagement />;
      case "finance": return <FinanceDashboard />;
      case "transactions": return <TransactionManagement />;
      case "transfer-review": return <TransferPaymentReviewPage />;
      case "payment-settings": return (
        <PaymentProviderSettingsPage
          restaurantId={requestedRestaurantId || brandSelection.selectedRestaurantId || null}
          restaurantName={brandSelection.selectedRestaurant?.name || ""}
        />
      );
      case "wallet": return <ManagerWalletPage />;
      case "settings":
      case "rates":
      case "setting": return <SettingsManagement />;
      case "backup": return <BackupManagement />;
      case "logs": return <SystemLogsPage restaurantId={requestedRestaurantId || brandSelection.selectedRestaurantId || null} isAdmin={isAdminUser} />;
      case "schedules": return <ScheduleManagementPage />;
      case "promotions": return <PromotionManagement />;
      case "payroll": return <PayrollManagement />;
      case "reviews": return <ReviewManagement />;
      case "print-management": return <PrintManagement />;
      case "restaurant-info-management":
        return (
          <>
            <RestaurantPublicationControl
              restaurantId={requestedRestaurantId || brandSelection.selectedRestaurantId || null}
            />
            <ManagerRestaurantInfoManagement />
          </>
        );
      case "rbac": return <RbacManagement />;
      case "system-users": return <SystemUserManagement />;
      case "ai-handoff": return <AiHandoffInbox restaurantId={requestedRestaurantId || brandSelection.selectedRestaurantId || null} />;
      case "ai-chatbot-analytics": return <AiChatbotAnalyticsPage />;
      case "ai-chatbot-settings": return <AiChatbotSettingsPage />;
      case "ai-chatbot-knowledge": return <AiChatbotKnowledgePage />;
      default: return <div className="manager-page-shell__empty">Trang bạn truy cập không tồn tại hoặc không còn khả dụng.</div>;
    }
  };

  return (
    <div className={`manager-layout manager-layout--${currentPage} ${sidebarOpen ? "sidebar-open" : ""}`}>
      {sidebarOpen && <div className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`} onClick={closeSidebar} aria-hidden="true" />}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} onToggle={toggleSidebar} onPageChange={handlePageChange} activeItem={currentPage} activeBrand={brandSelection.selectedBrand} />
      <div className="manager-layout__main">
        <div className="manager-layout__header">
          {IS_TEST_ENV ? (
            <Header {...headerProps} notifications={[]} />
          ) : (
            <ManagerHeaderWithNotifications {...headerProps} />
          )}
        </div>
        <main className="manager-layout__content">
          <section className={`manager-page-shell manager-page-shell--${currentPage}`}>
            <div className="manager-page-shell__body">
              <Suspense fallback={<PageLoadingFallback />}>{renderContent()}</Suspense>
            </div>
          </section>
        </main>
      </div>
      <Suspense fallback={null}>
        <TableTypeManagementPage
          isOpen={showTableSettings}
          onClose={() => setShowTableSettings(false)}
          restaurantId={requestedRestaurantId || brandSelection.selectedRestaurantId || null}
          restaurantName={brandSelection.selectedRestaurant?.name || ""}
        />
      </Suspense>
    </div>
  );
};

export default ManagerLayout;
