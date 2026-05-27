import React, { useState, useEffect, useMemo, useContext } from "react";
import Sidebar from "../components/Dashboard_Manager/Sidebar";
import Header from "../components/Dashboard_Manager/Header";
import Dashboard from "../components/Dashboard_Manager/Dashboard";
import ManagerAnalyst from "../components/Dashboard_Manager/Analyst/ManagerAnalyst";
import ReportsManagement from "../components/Dashboard_Manager/Reports/ReportsManagement";
import StaffManagement from "../components/Dashboard_Manager/Staff/StaffManagement";
import ScheduleManagementPage from "../components/Dashboard_Manager/Schedule/ScheduleManagementPage";
import OrderManagement from "../components/Dashboard_Manager/Order/OrderManagement";
import MenuManagement from "../components/Dashboard_Manager/Menu/MenuManagement";
import TableManagement from "../components/Dashboard_Manager/Table/TableManagement";
import CustomerManagement from "../components/Dashboard_Manager/Customer/CustomerManagement";
import CustomerAnalyticsPage from "../components/Dashboard_Manager/Customer/CustomerAnalyticsPage";
import AiChatbotAnalyticsPage from "../components/Dashboard_Manager/Customer/AiChatbotAnalyticsPage";
import AiChatbotSettingsPage from "../components/Dashboard_Manager/Customer/AiChatbotSettingsPage";
import AiChatbotKnowledgePage from "../components/Dashboard_Manager/Customer/AiChatbotKnowledgePage";
import PromotionManagement from "../components/Dashboard_Manager/Promotion/PromotionManagement";
import PayrollManagement from "../components/Dashboard_Manager/PayrollPage/PayrollManagement";
import "./ManagerLayout.scss";
import StorageManagement from "../components/Dashboard_Manager/Storage/StorageManagement";
import ReviewManagement from "../components/Dashboard_Manager/Review/ReviewManagement";
import FinanceDashboard from "@/components/Dashboard_Manager/Finance/FinanceDashboard";
import PrintManagement from "@/components/Dashboard_Manager/PrintManagement/PrintManagement";
import RbacManagement from "@/components/Dashboard_Manager/RBAC/RbacManagement";
import SettingsManagement from "@/components/Dashboard_Manager/Settings/SettingsManagement";
import BackupManagement from "@/components/Dashboard_Manager/Backup/BackupManagement";
import { ManagerRestaurantInfoManagement } from "@/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx";
import { AuthContext } from "@/context/AuthContext";
import { isAccountantRole, isHrRole, isManagerRole, isAdminRole } from "@/utils/frontendRoleAccess";
import { filterNavigationByPermissionAccess } from "@/utils/frontendPermissionAccess";
import AiHandoffInbox from "@/components/communication/AiHandoffInbox";

const MANAGER_CANONICAL_PATH = "/manager";

const VALID_MANAGER_PAGES = new Set([
  "dashboard",
  "tables",
  "orders",
  "menu",
  "inventory",
  "staff",
  "customers",
  "customer-analytics",
  "analytics",
  "transactions",
  "reports",
  "schedules",
  "promotions",
  "finance",
  "payroll",
  "reviews",
  "settings",
  "rates",
  "setting",
  "backup",
  "print-management",
  "restaurant-info-management",
  "rbac",
  "ai-handoff",
  "ai-chatbot-analytics",
  "ai-chatbot-settings",
  "ai-chatbot-knowledge",
]);

const resolveInitialManagerPage = () => {
  const hash = window.location.hash?.replace("#", "");
  if (hash && VALID_MANAGER_PAGES.has(hash)) return hash;

  const saved = localStorage.getItem("manager.currentPage");
  if (saved && VALID_MANAGER_PAGES.has(saved)) return saved;

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
  analytics: ["report.read"],
  orders: ["order.read"],
  menu: ["menu.read"],
  inventory: ["inventory.read", "stock.read"],
  tables: ["table.read"],
  "restaurant-info-management": ["restaurant.read"],
  staff: ["staff.read"],
  schedules: ["shift.read"],
  payroll: ["payroll.read"],
  customers: ["customer.read"],
  "customer-analytics": ["report.read"],
  promotions: ["promotion.read", "coupon.read"],
  reviews: ["review.read", "report.read"],
  reports: ["report.read"],
  finance: ["payment.read"],
  transactions: ["payment.read"],
  settings: ["system.manage"],
  rates: ["system.manage"],
  setting: ["system.manage"],
  backup: ["system.manage"],
  "print-management": ["print.read", "report.read"],
  rbac: ["role.read", "permission.read", "staff.write"],
  "ai-handoff": ["dashboard.read", "order.read"],
  "ai-chatbot-analytics": ["report.read"],
  "ai-chatbot-settings": ["report.read"],
  "ai-chatbot-knowledge": ["report.read"],
};

const PAGE_CONFIG = {
  dashboard: { title: "Tổng quan", description: "Tổng quan hiệu suất và số liệu vận hành nhà hàng", icon: "📊", keywords: ["overview", "thống kê", "kpi", "doanh thu", "dashboard"] },
  tables: { title: "Quản lý bàn", description: "Theo dõi trạng thái bàn, sơ đồ tầng và đặt chỗ", icon: "🪑", keywords: ["bàn", "table", "đặt bàn", "sơ đồ"] },
  orders: { title: "Quản lý đơn hàng", description: "Xử lý đơn tại chỗ, mang đi, giao hàng và thanh toán", icon: "🧾", keywords: ["order", "đơn", "timeline", "thanh toán"] },
  menu: { title: "Quản lý menu", description: "Quản lý món ăn, giá bán, danh mục và trạng thái phục vụ", icon: "🍜", keywords: ["món", "menu", "giá", "danh mục"] },
  inventory: { title: "Quản lý kho", description: "Theo dõi tồn kho, nhập xuất và cảnh báo nguyên liệu", icon: "📦", keywords: ["kho", "inventory", "nguyên liệu", "tồn"] },
  staff: { title: "Quản lý nhân viên", description: "Danh sách nhân viên, vai trò, trạng thái và phân công", icon: "👥", keywords: ["staff", "nhân viên", "vai trò", "quyền"] },
  customers: { title: "Quản lý khách hàng", description: "Thông tin khách, hạng thành viên, điểm và hành vi mua", icon: "🧑‍🤝‍🧑", keywords: ["khách hàng", "loyalty", "rank", "điểm"] },
  "customer-analytics": { title: "Phân tích khách hàng", description: "Phân tích phân khúc khách, khách quay lại, khách rời bỏ và cohort theo thời gian", icon: "📈", keywords: ["analytics", "phân tích", "khách", "insight"] },
  analytics: { title: "Phân tích kinh doanh", description: "Theo dõi doanh thu, nhu cầu, menu, nhân sự, khuyến mãi và hiệu suất vận hành", icon: "🧠", keywords: ["analyst", "ai", "chiến lược", "dự báo"] },
  reports: { title: "Báo cáo", description: "Báo cáo doanh thu, đơn hàng và xuất dữ liệu theo kỳ", icon: "📑", keywords: ["report", "báo cáo", "xuất file", "csv"] },
  finance: { title: "Tài chính", description: "Theo dõi thu chi, công nợ, hoàn tiền và đối soát", icon: "💰", keywords: ["finance", "thu", "chi", "công nợ", "profit"] },
  transactions: { title: "Giao dịch", description: "Theo dõi thanh toán, hoàn tiền và đối soát giao dịch", icon: "💳", keywords: ["transaction", "giao dịch", "payment", "thanh toán", "refund", "đối soát"] },
  schedules: { title: "Lịch làm việc", description: "Lập ca làm theo ngày/tuần/tháng và phân công nhân sự", icon: "📅", keywords: ["schedule", "ca làm", "shift", "lịch"] },
  promotions: { title: "Khuyến mãi", description: "Quản lý campaign, coupon, điều kiện và thời gian hiệu lực", icon: "🎁", keywords: ["promotion", "coupon", "discount", "khuyến mãi"] },
  payroll: { title: "Bảng lương", description: "Tổng hợp công, phụ cấp, thưởng phạt và kỳ lương nhân viên", icon: "💼", keywords: ["payroll", "salary", "lương", "thưởng", "khấu trừ"] },
  reviews: { title: "Đánh giá khách hàng", description: "Xem đánh giá, phản hồi và kiểm duyệt nội dung review", icon: "⭐", keywords: ["review", "đánh giá", "rating", "feedback"] },
  "print-management": { title: "Quản lý in ấn", description: "Cấu hình máy in, mẫu in, hàng đợi và retry print job", icon: "🖨️", keywords: ["print", "máy in", "phiếu bếp", "queue"] },
  "restaurant-info-management": { title: "Thông tin nhà hàng", description: "Cập nhật hồ sơ nhà hàng, giờ mở cửa và thông tin liên hệ", icon: "🏪", keywords: ["nhà hàng", "restaurant", "địa chỉ", "liên hệ"] },
  rbac: { title: "Phân quyền nhân viên", description: "Quản lý vai trò, quyền hạn và gán vai trò cho nhân viên", icon: "🛡️", keywords: ["phân quyền", "vai trò", "quyền hạn", "rbac", "nhân viên"] },
  "ai-handoff": { title: "Handoff AI", description: "Xử lý yêu cầu hỗ trợ từ chatbot", icon: "🤖", keywords: ["handoff", "chatbot", "support"] },
  "ai-chatbot-analytics": { title: "AI Chatbot Analytics", description: "Theo dõi số liệu tổng hợp chatbot và handoff", icon: "📡", keywords: ["ai", "chatbot", "analytics", "handoff"] },
  "ai-chatbot-knowledge": { title: "AI Chatbot Knowledge", description: "Quản lý tri thức/FAQ cho chatbot theo từng nhà hàng", icon: "📚", keywords: ["ai", "chatbot", "knowledge", "faq"] },
  settings: { title: "Cài đặt hệ thống", description: "Cấu hình vận hành, phân quyền, in ấn và thông tin nhà hàng", icon: "⚙️", keywords: ["settings", "cài đặt", "hệ thống", "cấu hình", "quyền"] },
  rates: { title: "Cài đặt hệ thống", description: "Cấu hình vận hành, phân quyền, in ấn và thông tin nhà hàng", icon: "⚙️", keywords: ["settings", "cài đặt", "hệ thống", "cấu hình", "quyền"] },
  setting: { title: "Cài đặt hệ thống", description: "Cấu hình vận hành, phân quyền, in ấn và thông tin nhà hàng", icon: "⚙️", keywords: ["settings", "cài đặt", "hệ thống", "cấu hình", "quyền"] },
  backup: { title: "Sao lưu & khôi phục", description: "Checklist sao lưu dữ liệu, đối soát và điều hướng xuất báo cáo", icon: "🗄️", keywords: ["backup", "sao lưu", "khôi phục", "export", "báo cáo"] },
};

const PermissionFallback = () => (
  <div className="manager-page-shell__empty">Bạn không có quyền truy cập chức năng này.</div>
);

const ManagerLayout = () => {
  const { user } = useContext(AuthContext);
  const roleName = user?.roleName || user?.role?.slug;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(resolveInitialManagerPage);
  const validPages = useMemo(() => VALID_MANAGER_PAGES, []);
  const allowedPages = useMemo(() => {
    const navItems = Object.entries(MANAGER_PAGE_PERMISSION_ACCESS).map(([id, permissions]) => ({ id, permissions }));
    return new Set(filterNavigationByPermissionAccess(navItems, user).map((item) => item.id));
  }, [user]);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash?.replace("#", "");
      if (hash && validPages.has(hash)) setCurrentPage(hash);
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [validPages]);

  useEffect(() => {
    if (validPages.has(currentPage)) {
      localStorage.setItem("manager.currentPage", currentPage);
      const expectedHash = `#${currentPage}`;
      if (
        window.location.pathname !== MANAGER_CANONICAL_PATH ||
        window.location.hash !== expectedHash
      ) {
        history.replaceState(null, "", `${MANAGER_CANONICAL_PATH}${expectedHash}`);
      }
    }
  }, [currentPage, validPages]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768 && sidebarOpen) setSidebarOpen(false);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen]);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  const preferredFallbackPage = useMemo(() => {
    if (isHrRole(roleName)) return "staff";
    if (isAccountantRole(roleName)) return "payroll";
    if (isAdminRole(roleName) || isManagerRole(roleName)) return "dashboard";
    return "dashboard";
  }, [roleName]);

  useEffect(() => {
    if (allowedPages.has(currentPage) || window.location.hash) return;

    const nextPage = allowedPages.has(preferredFallbackPage)
      ? preferredFallbackPage
      : [...allowedPages][0] || "dashboard";

    if (nextPage !== currentPage) setCurrentPage(nextPage);
  }, [allowedPages, currentPage, preferredFallbackPage]);

  useEffect(() => {
    const handleManagerNavigate = (event) => {
      const page = event?.detail?.page;
      const query = event?.detail?.query || {};
      if (!page || !validPages.has(page)) return;
      if (!allowedPages.has(page)) return;

      setCurrentPage(page);
      setSidebarOpen(false);
      localStorage.setItem("manager.currentPage", page);

      history.replaceState(
        null,
        "",
        buildManagerNavigationUrl({ page, query }),
      );

      window.dispatchEvent(
        new CustomEvent("manager:navigation-query", {
          detail: {
            page,
            query,
            source: event?.detail?.source || "manager:navigate",
          },
        }),
      );
    };

    window.addEventListener("manager:navigate", handleManagerNavigate);
    return () =>
      window.removeEventListener("manager:navigate", handleManagerNavigate);
  }, [allowedPages, validPages]);

  const managerSearchItems = useMemo(
    () =>
      [...VALID_MANAGER_PAGES]
        .filter((page) => PAGE_CONFIG[page] && allowedPages.has(page))
        .map((page) => ({
          id: page,
          title: PAGE_CONFIG[page].title,
          description: PAGE_CONFIG[page].description,
          category: "Điều hướng",
          icon: PAGE_CONFIG[page].icon || "📍",
          type: "navigation",
          keywords: PAGE_CONFIG[page].keywords || [],
          route: `#${page}`,
        })),
    [allowedPages]
  );

  const renderContent = () => {
    if (!allowedPages.has(currentPage)) return <PermissionFallback />;

    switch (currentPage) {
      case "dashboard": return <Dashboard />;
      case "tables": return <TableManagement />;
      case "orders": return <OrderManagement />;
      case "menu": return <MenuManagement />;
      case "inventory": return <StorageManagement />;
      case "staff": return <StaffManagement />;
      case "customers": return <CustomerManagement />;
      case "customer-analytics": return <CustomerAnalyticsPage />;
      case "analytics": return <ManagerAnalyst />;
      case "reports": return <ReportsManagement />;
      case "finance": return <FinanceDashboard />;
      case "transactions": return <FinanceDashboard />;
      case "settings":
      case "rates":
      case "setting": return <SettingsManagement />;
      case "backup": return <BackupManagement />;
      case "schedules": return <ScheduleManagementPage />;
      case "promotions": return <PromotionManagement />;
      case "payroll": return <PayrollManagement />;
      case "reviews": return <ReviewManagement />;
      case "print-management": return <PrintManagement />;
      case "restaurant-info-management": return <ManagerRestaurantInfoManagement />;
      case "rbac": return <RbacManagement />;
      case "ai-handoff": return <AiHandoffInbox />;
      case "ai-chatbot-analytics": return <AiChatbotAnalyticsPage />;
      case "ai-chatbot-settings": return <AiChatbotSettingsPage />;
      case "ai-chatbot-knowledge": return <AiChatbotKnowledgePage />;
      default: return <div className="manager-page-shell__empty">Trang bạn truy cập không tồn tại hoặc không còn khả dụng.</div>;
    }
  };

  return (
    <div className={`manager-layout manager-layout--${currentPage} ${sidebarOpen ? "sidebar-open" : ""}`}>
      {sidebarOpen && <div className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`} onClick={closeSidebar} />}

      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} onPageChange={setCurrentPage} activeItem={currentPage} />

      <div className="manager-layout__main">
        <div className="manager-layout__header">
          <Header
            pageTitle={PAGE_CONFIG[currentPage]?.title || "Trang quản trị"}
            onToggleSidebar={toggleSidebar}
            sidebarOpen={sidebarOpen}
            notifications={[]}
            searchItems={managerSearchItems}
            onSelectSearchResult={(item) => {
              if (!item?.id) return;
              setCurrentPage(item.id);
              setSidebarOpen(false);
            }}
          />
        </div>

        <main className="manager-layout__content">
          <section className={`manager-page-shell manager-page-shell--${currentPage}`}>
            <div className="manager-page-shell__body">{renderContent()}</div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default ManagerLayout;