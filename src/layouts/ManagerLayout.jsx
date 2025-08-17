import React, { useState, useEffect } from "react";
import Sidebar from "../components/Dashboard_Manager/Sidebar";
import Header from "../components/Dashboard_Manager/Header";
import "./ManagerLayout.scss";
const ManagerLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState("Tổng quan");

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
        <main className="manager-layout__content">{children}</main>
      </div>
    </div>
  );
};

export default ManagerLayout;
