import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "../components/Dashboard_Manager/Sidebar";
import Header from "../components/Dashboard_Manager/Header";
import Dashboard from "../components/Dashboard_Manager/Dashboard";
import ManagerAnalyst from "../components/Dashboard_Manager/Analyst/ManagerAnalyst";
import StaffManagement from "../components/Dashboard_Manager/Staff/StaffManagement";
import ScheduleManagement from "../components/Dashboard_Manager/Schedule/ScheduleManagement";
import OrderManagement from "../components/Dashboard_Manager/Order/OrderManagement";
import MenuManagement from "../components/Dashboard_Manager/Menu/MenuManagement";
import TableManagement from "../components/Dashboard_Manager/Table/TableManagement";
import CustomerManagement from "../components/Dashboard_Manager/Customer/CustomerManagement";
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
} from "@ant-design/icons";
const PAGE_META = {
  dashboard: {
    title: "Tổng quan vận hành",
    subtitle: "Theo dõi dữ liệu nhà hàng theo thời gian thực với giao diện quản trị hiện đại.",
    icon: <BarChartOutlined />,
  },
  tables: {
    title: "Quản lý bàn",
    subtitle: "Kiểm soát sơ đồ bàn, trạng thái sử dụng và tốc độ phục vụ trực tiếp.",
    icon: <TableOutlined />,
  },
  orders: {
    title: "Quản lý đơn hàng",
    subtitle: "Tập trung xử lý đơn, đồng bộ trạng thái và tối ưu thời gian phản hồi.",
    icon: <ShoppingCartOutlined />,
  },
  menu: {
    title: "Quản lý thực đơn",
    subtitle: "Cập nhật món ăn, giá bán và danh mục theo chuẩn hiển thị mới.",
    icon: <AppstoreOutlined />,
  },
  inventory: {
    title: "Quản lý kho",
    subtitle: "Theo dõi tồn kho, nguyên liệu và cảnh báo nhập hàng trong một màn hình.",
    icon: <InboxOutlined />,
  },
  staff: {
    title: "Quản lý nhân sự",
    subtitle: "Quản lý thông tin nhân viên, phân quyền và hiệu suất làm việc đồng bộ.",
    icon: <TeamOutlined />,
  },
  customers: {
    title: "Quản lý khách hàng",
    subtitle: "Nâng cao trải nghiệm khách thân thiết bằng dữ liệu tập trung và trực quan.",
    icon: <TeamOutlined />,
  },
  analytics: {
    title: "Phân tích vận hành",
    subtitle: "Đọc số liệu kinh doanh sâu hơn với dashboard nhiều lớp thông tin.",
    icon: <BarChartOutlined />,
  },
  finance: {
    title: "Quản lý tài chính",
    subtitle: "Theo dõi doanh thu, chi phí và dòng tiền với cấu trúc dễ kiểm soát.",
    icon: <DollarOutlined />,
  },
  promotions: {
    title: "Quản lý khuyến mãi",
    subtitle: "Tạo ưu đãi linh hoạt để thúc đẩy chuyển đổi và tăng lượt quay lại.",
    icon: <StarOutlined />,
  },
  reviews: {
    title: "Quản lý đánh giá",
    subtitle: "Theo dõi phản hồi khách hàng để cải thiện chất lượng dịch vụ tức thời.",
    icon: <StarOutlined />,
  },
  "print-management": {
    title: "Quản lý in ấn",
    subtitle: "Cấu hình thiết bị in và quy trình phát lệnh nhanh, ổn định.",
    icon: <AppstoreOutlined />,
  },
  "restaurant-info-management": {
    title: "Hồ sơ nhà hàng",
    subtitle: "Quản lý hình ảnh, thương hiệu và thông tin hiển thị chuẩn trải nghiệm mới.",
    icon: <ShopOutlined />,
  },
};

const ManagerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("dashboard");

  const validPages = useMemo(
    () =>
      new Set([
        "dashboard",
        "tables",
        "orders",
        "menu",
        "inventory",
        "staff",
        "customers",
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
      ]),
    []
  );
  useEffect(() => {
    const hash = window.location.hash?.replace("#", "");
    if (hash && validPages.has(hash)) {
      setCurrentPage(hash);
      return;
    }
    const saved = localStorage.getItem("manager.currentPage");
    if (saved && validPages.has(saved)) {
      setCurrentPage(saved);
    }
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

  const notifications = [
    {
      id: 1,
      title: "Đơn hàng mới #1234",
      message: "Bàn 5 vừa đặt 2 món phở bò",
      time: "2 phút trước",
      type: "primary",
      icon: "🛒",
      read: false,
    },
    {
      id: 2,
      title: "Nhân viên chấm công",
      message: "Nguyễn Văn A đã check-in lúc 8:00",
      time: "15 phút trước",
      type: "success",
      icon: "👤",
      read: false,
    },
  ];

  const user = {
    name: "Nguyễn Quản Lý",
    role: "Quản lý cửa hàng",
    email: "manager@restaurant.com",
    avatar: "👨‍💼",
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  const currentMeta = PAGE_META[currentPage] || {
    title: "Trang quản lý",
    subtitle: "Không gian quản trị tập trung theo tiêu chuẩn giao diện mới.",
    icon: <ShopOutlined />,
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
      case "analytics":
        return <ManagerAnalyst />;

      // case "transactions": return <Transactions />;
      // case "reports": return <Reports />;
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
            pageTitle={currentPage}
            onToggleSidebar={toggleSidebar}
            sidebarOpen={sidebarOpen}
            notifications={notifications}
            user={user}
          />
        </div>

        {/* Content */}
        <main className="manager-layout__content">
          <section className="manager-page-shell">
            <div className="manager-page-shell__hero">
              <div className="hero-badge">{currentMeta.icon}</div>
              <div className="hero-text">
                <h1>{currentMeta.title}</h1>
                <p>{currentMeta.subtitle}</p>
              </div>
              <div className="hero-chips">
                <span>Design System mới</span>
                <span>Live Data Ready</span>
                <span>Responsive UX</span>
              </div>
            </div>
            <div className="manager-page-shell__body">{renderContent()}</div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default ManagerLayout;
