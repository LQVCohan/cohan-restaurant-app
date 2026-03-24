import React, { useState, useEffect, useMemo } from "react";
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
import {
  BarChartOutlined,
  ShopOutlined,
  TableOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  AppstoreOutlined,
  InboxOutlined,
  StarOutlined,
  DollarOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  RocketOutlined,
} from "@ant-design/icons";

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

const PAGE_TITLES = {
  dashboard: "Tổng quan",
  tables: "Quản lý bàn",
  orders: "Quản lý đơn hàng",
  menu: "Quản lý menu",
  inventory: "Quản lý kho",
  staff: "Quản lý nhân viên",
  customers: "Quản lý khách hàng",
  "customer-analytics": "Phân tích khách hàng",
  analytics: "Phân tích kinh doanh",
  reports: "Báo cáo",
  finance: "Tài chính",
  schedules: "Lịch làm việc",
  promotions: "Khuyến mãi",
  payroll: "Bảng lương",
  reviews: "Đánh giá khách hàng",
  "print-management": "Quản lý in ấn",
  "restaurant-info-management": "Thông tin nhà hàng",
  settings: "Cài đặt",
  rates: "Cài đặt",
  setting: "Cài đặt",
  backup: "Cài đặt",
};

const ManagerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(resolveInitialManagerPage);
  const validPages = useMemo(() => VALID_MANAGER_PAGES, []);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash?.replace("#", "");
      if (hash && validPages.has(hash)) {
        setCurrentPage(hash);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [validPages]);

  useEffect(() => {
    if (validPages.has(currentPage)) {
      localStorage.setItem("manager.currentPage", currentPage);
      if (window.location.hash !== `#${currentPage}`) {
        history.replaceState(null, "", `#${currentPage}`);
      }
    }
  }, [currentPage, validPages]);
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
            pageTitle={PAGE_TITLES[currentPage] || "Trang quản trị"}
            onToggleSidebar={toggleSidebar}
            sidebarOpen={sidebarOpen}
            notifications={[]}
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
