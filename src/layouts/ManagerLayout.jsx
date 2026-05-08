import React, { useState, useEffect, useMemo, useContext } from "react";
import Sidebar from "../components/Dashboard_Manager/Sidebar";
import Header from "../components/Dashboard_Manager/Header";
import Dashboard from "../components/Dashboard_Manager/Dashboard";
import ManagerAnalyst from "../components/Dashboard_Manager/Analyst/ManagerAnalyst";
import ReportsManagement from "../components/Dashboard_Manager/Reports/ReportsManagement";
import StaffManagement from "../components/Dashboard_Manager/Staff/StaffManagement";
import ScheduleManagement from "../components/Dashboard_Manager/Schedule/ScheduleManagement";
import OrderManagement from "../components/Dashboard_Manager/Order/OrderManagement";
import MenuManagement from "../components/Dashboard_Manager/Menu/MenuManagement";
import TableManagement from "../components/Dashboard_Manager/Table/TableManagement";
import CustomerManagement from "../components/Dashboard_Manager/Customer/CustomerManagement";
import CustomerAnalyticsPage from "../components/Dashboard_Manager/Customer/CustomerAnalyticsPage";
import PromotionManagement from "../components/Dashboard_Manager/Promotion/PromotionManagement";
import PayrollManagement from "../components/Dashboard_Manager/PayrollPage/PayrollManagement";
import "./ManagerLayout.scss";
import StorageManagement from "../components/Dashboard_Manager/Storage/StorageManagement";
import ReviewManagement from "../components/Dashboard_Manager/Review/ReviewManagement";
import FinanceDashboard from "@/components/Dashboard_Manager/Finance/FinanceDashboard";
import PrintManagement from "@/components/Dashboard_Manager/PrintManagement/PrintManagement";
import { ManagerRestaurantInfoManagement } from "@/components/Dashboard_Manager/RestaurantInfo/RestaurantInfoManagement.jsx";
import { AuthContext } from "@/context/AuthContext";
import { filterNavigationByRole, isAccountantRole, isHrRole, isManagerRole, isAdminRole } from "@/utils/roleAccess";

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
  "settings",
  "schedules",
  "promotions",
  "rates",
  "finance",
  "setting",
  "payroll",
  "backup",
  "reviews",
  "print-management",
  "restaurant-info-management",
]);

const resolveInitialManagerPage = () => {
  const hash = window.location.hash?.replace("#", "");
  if (hash && VALID_MANAGER_PAGES.has(hash)) return hash;

  const saved = localStorage.getItem("manager.currentPage");
  if (saved && VALID_MANAGER_PAGES.has(saved)) return saved;

  return "dashboard";
};


const MANAGER_PAGE_ROLE_ACCESS = {
  dashboard: ["admin", "manager", "hr", "accountant"],
  analytics: ["admin", "manager"],
  orders: ["admin", "manager"],
  menu: ["admin", "manager"],
  inventory: ["admin", "manager"],
  tables: ["admin", "manager"],
  "restaurant-info-management": ["admin", "manager"],
  staff: ["admin", "manager", "hr"],
  schedules: ["admin", "manager", "hr"],
  payroll: ["admin", "manager", "accountant"],
  customers: ["admin", "manager"],
  "customer-analytics": ["admin", "manager"],
  promotions: ["admin", "manager"],
  reviews: ["admin", "manager"],
  reports: ["admin", "manager", "accountant"],
  finance: ["admin", "manager", "accountant"],
  settings: ["admin"],
  rates: ["admin"],
  setting: ["admin"],
  backup: ["admin"],
  "print-management": ["admin", "manager"],
};

const PAGE_CONFIG = {
  dashboard: {
    title: "Tổng quan",
    description: "Tổng quan hiệu suất và số liệu vận hành nhà hàng",
    icon: "📊",
    keywords: ["overview", "thống kê", "kpi", "doanh thu", "dashboard"],
  },
  tables: {
    title: "Quản lý bàn",
    description: "Theo dõi trạng thái bàn, sơ đồ tầng và đặt chỗ",
    icon: "🪑",
    keywords: ["bàn", "table", "đặt bàn", "sơ đồ"],
  },
  orders: {
    title: "Quản lý đơn hàng",
    description: "Xử lý đơn tại chỗ, mang đi, giao hàng và thanh toán",
    icon: "🧾",
    keywords: ["order", "đơn", "timeline", "thanh toán"],
  },
  menu: {
    title: "Quản lý menu",
    description: "Quản lý món ăn, giá bán, danh mục và trạng thái phục vụ",
    icon: "🍜",
    keywords: ["món", "menu", "giá", "danh mục"],
  },
  inventory: {
    title: "Quản lý kho",
    description: "Theo dõi tồn kho, nhập xuất và cảnh báo nguyên liệu",
    icon: "📦",
    keywords: ["kho", "inventory", "nguyên liệu", "tồn"],
  },
  staff: {
    title: "Quản lý nhân viên",
    description: "Danh sách nhân viên, vai trò, trạng thái và phân công",
    icon: "👥",
    keywords: ["staff", "nhân viên", "vai trò", "quyền"],
  },
  customers: {
    title: "Quản lý khách hàng",
    description: "Thông tin khách, hạng thành viên, điểm và hành vi mua",
    icon: "🧑‍🤝‍🧑",
    keywords: ["khách hàng", "loyalty", "rank", "điểm"],
  },
  "customer-analytics": {
    title: "Phân tích khách hàng",
    description: "Phân tích nhóm khách, món phổ biến và mức độ gắn bó",
    icon: "📈",
    keywords: ["analytics", "phân tích", "khách", "insight"],
  },
  analytics: {
    title: "Phân tích kinh doanh",
    description: "Theo dõi xu hướng doanh thu và đề xuất tối ưu vận hành",
    icon: "🧠",
    keywords: ["analyst", "ai", "chiến lược", "dự báo"],
  },
  reports: {
    title: "Báo cáo",
    description: "Báo cáo doanh thu, đơn hàng và xuất dữ liệu theo kỳ",
    icon: "📑",
    keywords: ["report", "báo cáo", "xuất file", "csv"],
  },
  finance: {
    title: "Tài chính",
    description: "Theo dõi thu chi, công nợ, hoàn tiền và đối soát",
    icon: "💰",
    keywords: ["finance", "thu", "chi", "công nợ", "profit"],
  },
  schedules: {
    title: "Lịch làm việc",
    description: "Lập ca làm theo ngày/tuần/tháng và phân công nhân sự",
    icon: "📅",
    keywords: ["schedule", "ca làm", "shift", "lịch"],
  },
  promotions: {
    title: "Khuyến mãi",
    description: "Quản lý campaign, voucher, điều kiện và thời gian hiệu lực",
    icon: "🎁",
    keywords: ["promotion", "voucher", "discount", "khuyến mãi"],
  },
  payroll: {
    title: "Bảng lương",
    description: "Tổng hợp công, phụ cấp, thưởng phạt và kỳ lương nhân viên",
    icon: "💼",
    keywords: ["payroll", "salary", "lương", "thưởng", "khấu trừ"],
  },
  reviews: {
    title: "Đánh giá khách hàng",
    description: "Xem đánh giá, phản hồi và kiểm duyệt nội dung review",
    icon: "⭐",
    keywords: ["review", "đánh giá", "rating", "feedback"],
  },
  "print-management": {
    title: "Quản lý in ấn",
    description: "Cấu hình máy in, mẫu in, hàng đợi và retry print job",
    icon: "🖨️",
    keywords: ["print", "máy in", "phiếu bếp", "queue"],
  },
  "restaurant-info-management": {
    title: "Thông tin nhà hàng",
    description: "Cập nhật hồ sơ nhà hàng, giờ mở cửa và thông tin liên hệ",
    icon: "🏪",
    keywords: ["nhà hàng", "restaurant", "địa chỉ", "liên hệ"],
  },
  settings: {
    title: "Cài đặt",
    description: "Cấu hình hệ thống và tuỳ chọn vận hành",
    icon: "⚙️",
    keywords: ["settings", "cài đặt"],
  },
  rates: {
    title: "Cài đặt",
    description: "Cấu hình hệ thống và tuỳ chọn vận hành",
    icon: "⚙️",
    keywords: ["settings", "cài đặt"],
  },
  setting: {
    title: "Cài đặt",
    description: "Cấu hình hệ thống và tuỳ chọn vận hành",
    icon: "⚙️",
    keywords: ["settings", "cài đặt"],
  },
  backup: {
    title: "Cài đặt",
    description: "Cấu hình hệ thống và tuỳ chọn vận hành",
    icon: "⚙️",
    keywords: ["backup", "sao lưu"],
  },
};

const ManagerLayout = () => {
  const { user } = useContext(AuthContext);
  const roleName = user?.roleName || user?.role?.slug;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(resolveInitialManagerPage);
  const validPages = useMemo(() => VALID_MANAGER_PAGES, []);
  const allowedPages = useMemo(() => {
    const navItems = Object.entries(MANAGER_PAGE_ROLE_ACCESS).map(([id, roles]) => ({ id, roles }));
    return new Set(filterNavigationByRole(navItems, roleName).map((item) => item.id));
  }, [roleName]);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash?.replace("#", "");
      if (hash && validPages.has(hash) && allowedPages.has(hash)) {
        setCurrentPage(hash);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [allowedPages, validPages]);

  useEffect(() => {
    if (validPages.has(currentPage) && allowedPages.has(currentPage)) {
      localStorage.setItem("manager.currentPage", currentPage);
      if (window.location.hash !== `#${currentPage}`) {
        history.replaceState(null, "", `#${currentPage}`);
      }
    }
  }, [allowedPages, currentPage, validPages]);
  // Close sidebar on window resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen]);

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  const preferredFallbackPage = useMemo(() => {
    if (isHrRole(roleName)) return "staff";
    if (isAccountantRole(roleName)) return "payroll";
    if (isAdminRole(roleName) || isManagerRole(roleName)) return "dashboard";
    return "dashboard";
  }, [roleName]);

  useEffect(() => {
    if (allowedPages.has(currentPage)) return;

    const nextPage = allowedPages.has(preferredFallbackPage)
      ? preferredFallbackPage
      : [...allowedPages][0] || "dashboard";

    if (nextPage !== currentPage) setCurrentPage(nextPage);
  }, [allowedPages, currentPage, preferredFallbackPage]);

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
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "tables":
        return <TableManagement />;
      case "orders":
        return <OrderManagement />;
      case "menu":
        return <MenuManagement />;
      case "inventory":
        return <StorageManagement />;
      case "staff":
        return <StaffManagement />;
      case "customers":
        return <CustomerManagement />;
      case "customer-analytics":
        return <CustomerAnalyticsPage />;
      case "analytics":
        return <ManagerAnalyst />;

      // case "transactions": return <Transactions />;
      case "reports":
        return <ReportsManagement />;
      case "finance":
        return <FinanceDashboard />;
      case "settings":
      case "rates":
      case "setting":
      case "backup":
        return <div>Đang phát triển…</div>;
      case "schedules":
        return <ScheduleManagement />;
      case "promotions":
        return <PromotionManagement />;
      case "payroll":
        return <PayrollManagement />;
      case "reviews":
        return <ReviewManagement />;
      case "print-management":
        return <PrintManagement />;
      case "restaurant-info-management":
        return <ManagerRestaurantInfoManagement />;
      default:
        return <div>Content not found</div>;
    }
  };

  return (
    <div className={`manager-layout ${sidebarOpen ? "sidebar-open" : ""}`}>
      {/* Sidebar Overlay for mobile */}
      {sidebarOpen && (
        <div
          className={`sidebar-overlay ${sidebarOpen ? "active" : ""}`}
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        onPageChange={setCurrentPage}
        activeItem={currentPage}
      />

      {/* Main Content Area */}
      <div className="manager-layout__main">
        {/* Header */}
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

        {/* Content */}
        <main className="manager-layout__content">
          <section
            className={`manager-page-shell manager-page-shell--${currentPage}`}
          >
            <div className="manager-page-shell__body">{renderContent()}</div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default ManagerLayout;
