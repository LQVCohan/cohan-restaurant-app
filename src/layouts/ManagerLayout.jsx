import React, { useState, useEffect } from "react";
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
import "./ManagerLayout.scss";
const ManagerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("dashboard");

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

  const closeSidebar = () => {
    setSidebarOpen(false);
  };
  const renderContent = () => {
    console.log("content: ", currentPage);
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
        return <Inventory />;
      case "staff":
        return <StaffManagement />;
      case "customers":
        return <CustomerManagement />;
      case "analytics":
        return <ManagerAnalyst />;
      case "transactions":
        return <Transactions />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      case "schedules":
        return <ScheduleManagement />;
      case "promotions":
        return <PromotionManagement />;
      case "rates":
        return <Settings />;
      case "finance":
        return <Settings />;
      case "setting":
        return <Settings />;
      case "back-up":
        return <Settings />;
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
        <main className="manager-layout__content">{renderContent()}</main>
      </div>
    </div>
  );
};

export default ManagerLayout;
