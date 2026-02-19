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
  ThunderboltOutlined,
  CheckCircleOutlined,
  RocketOutlined,
} from "@ant-design/icons";
const PAGE_META = {
  dashboard: {
    title: "Tổng quan vận hành",
    subtitle: "Theo dõi dữ liệu nhà hàng theo thời gian thực với giao diện quản trị hiện đại.",
    icon: <BarChartOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Realtime KPI" },
      { icon: <CheckCircleOutlined />, label: "Health Check" },
      { icon: <RocketOutlined />, label: "Auto Insights" },
    ],
  },
  tables: {
    title: "Quản lý bàn",
    subtitle: "Kiểm soát sơ đồ bàn, trạng thái sử dụng và tốc độ phục vụ trực tiếp.",
    icon: <TableOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Table Live" },
      { icon: <CheckCircleOutlined />, label: "Occupancy" },
      { icon: <RocketOutlined />, label: "Flow Optimized" },
    ],
  },
  orders: {
    title: "Quản lý đơn hàng",
    subtitle: "Tập trung xử lý đơn, đồng bộ trạng thái và tối ưu thời gian phản hồi.",
    icon: <ShoppingCartOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Order Stream" },
      { icon: <CheckCircleOutlined />, label: "SLA Tracking" },
      { icon: <RocketOutlined />, label: "Quick Dispatch" },
    ],
  },
  menu: {
    title: "Quản lý thực đơn",
    subtitle: "Cập nhật món ăn, giá bán và danh mục theo chuẩn hiển thị mới.",
    icon: <AppstoreOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Menu Sync" },
      { icon: <CheckCircleOutlined />, label: "Quality Gate" },
      { icon: <RocketOutlined />, label: "Visual Ready" },
    ],
  },
  inventory: {
    title: "Quản lý kho",
    subtitle: "Theo dõi tồn kho, nguyên liệu và cảnh báo nhập hàng trong một màn hình.",
    icon: <InboxOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Stock Pulse" },
      { icon: <CheckCircleOutlined />, label: "Low-stock Alerts" },
      { icon: <RocketOutlined />, label: "Demand Forecast" },
    ],
  },
  staff: {
    title: "Quản lý nhân sự",
    subtitle: "Quản lý thông tin nhân viên, phân quyền và hiệu suất làm việc đồng bộ.",
    icon: <TeamOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Shift Live" },
      { icon: <CheckCircleOutlined />, label: "Role Matrix" },
      { icon: <RocketOutlined />, label: "Performance View" },
    ],
  },
  customers: {
    title: "Quản lý khách hàng",
    subtitle: "Nâng cao trải nghiệm khách thân thiết bằng dữ liệu tập trung và trực quan.",
    icon: <TeamOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Customer 360" },
      { icon: <CheckCircleOutlined />, label: "Retention Signals" },
      { icon: <RocketOutlined />, label: "Campaign Ready" },
    ],
  },
  analytics: {
    title: "Phân tích vận hành",
    subtitle: "Đọc số liệu kinh doanh sâu hơn với dashboard nhiều lớp thông tin.",
    icon: <BarChartOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Deep Analytics" },
      { icon: <CheckCircleOutlined />, label: "Trend Matrix" },
      { icon: <RocketOutlined />, label: "Smart Compare" },
    ],
  },
  schedules: {
    title: "Lịch làm việc",
    subtitle: "Điều phối ca trực hiệu quả với hiển thị theo thời gian và nhân sự.",
    icon: <TeamOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Shift Planner" },
      { icon: <CheckCircleOutlined />, label: "Conflict Guard" },
      { icon: <RocketOutlined />, label: "Auto Allocation" },
    ],
  },
  payroll: {
    title: "Lương thưởng",
    subtitle: "Theo dõi bảng lương minh bạch, nhất quán và dễ kiểm soát.",
    icon: <DollarOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Payroll Flow" },
      { icon: <CheckCircleOutlined />, label: "Audit Ready" },
      { icon: <RocketOutlined />, label: "Smart Export" },
    ],
  },
  finance: {
    title: "Quản lý tài chính",
    subtitle: "Theo dõi doanh thu, chi phí và dòng tiền với cấu trúc dễ kiểm soát.",
    icon: <DollarOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Cashflow Live" },
      { icon: <CheckCircleOutlined />, label: "Margin Watch" },
      { icon: <RocketOutlined />, label: "Forecast Engine" },
    ],
  },
  promotions: {
    title: "Quản lý khuyến mãi",
    subtitle: "Tạo ưu đãi linh hoạt để thúc đẩy chuyển đổi và tăng lượt quay lại.",
    icon: <StarOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Promo Builder" },
      { icon: <CheckCircleOutlined />, label: "ROI Focus" },
      { icon: <RocketOutlined />, label: "Funnel Boost" },
    ],
  },
  reviews: {
    title: "Quản lý đánh giá",
    subtitle: "Theo dõi phản hồi khách hàng để cải thiện chất lượng dịch vụ tức thời.",
    icon: <StarOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Sentiment Live" },
      { icon: <CheckCircleOutlined />, label: "Response SLA" },
      { icon: <RocketOutlined />, label: "Reputation Lift" },
    ],
  },
  "print-management": {
    title: "Quản lý in ấn",
    subtitle: "Cấu hình thiết bị in và quy trình phát lệnh nhanh, ổn định.",
    icon: <AppstoreOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Printer Health" },
      { icon: <CheckCircleOutlined />, label: "Queue Monitor" },
      { icon: <RocketOutlined />, label: "Fast Dispatch" },
    ],
  },
  "restaurant-info-management": {
    title: "Hồ sơ nhà hàng",
    subtitle: "Quản lý hình ảnh, thương hiệu và thông tin hiển thị chuẩn trải nghiệm mới.",
    icon: <ShopOutlined />,
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Brand Consistency" },
      { icon: <CheckCircleOutlined />, label: "Profile QA" },
      { icon: <RocketOutlined />, label: "Preview Sync" },
    ],
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
    highlights: [
      { icon: <ThunderboltOutlined />, label: "Unified UX" },
      { icon: <CheckCircleOutlined />, label: "Consistent State" },
      { icon: <RocketOutlined />, label: "Modern Ready" },
    ],
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
          <section className={`manager-page-shell manager-page-shell--${currentPage}`}>
            <div className="manager-page-shell__hero">
              <div className="hero-badge">{currentMeta.icon}</div>
              <div className="hero-text">
                <h1>{currentMeta.title}</h1>
                <p>{currentMeta.subtitle}</p>
              </div>
              <div className="hero-chips">
                {currentMeta.highlights.map((item) => (
                  <span key={item.label}>
                    {item.icon} {item.label}
                  </span>
                ))}
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
