import React, { useMemo } from "react";
import { Calendar, Store } from "lucide-react";
import { useDashboard } from "../../../hooks/useDashboard";

import Header from "./components/Header";
import StatsGrid from "./components/StatsGrid";
import QuickActions from "./components/QuickActions";

import RevenueChart from "./components/RevenueChart";
import RecentOrders from "./components/RecentOrders";
import TopDishes from "./components/TopDishes";

import "./Dashboard.scss";

const Dashboard = () => {
  const {
    selectedRestaurant,
    stats,
    handleRestaurantChange,
    handleSwitchToPOS,
    handleGenerateReport,
    loading,
  } = useDashboard();

  // Logic lời chào
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Chào buổi sáng";
    if (hour < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  }, []);

  const today = new Date().toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="dashboard-container fade-in">
      {/* 1. Top Bar: Greeting & Global Controls */}
      <div className="dashboard-top-bar">
        <div className="greeting-group">
          <h1 className="greeting-title">
            {greeting}, <span className="highlight">Quản lý</span>
          </h1>
          <div className="greeting-meta">
            <span className="date">
              <Calendar size={14} /> {today}
            </span>
            <span className="divider">•</span>
            <span className="location">
              <Store size={14} />{" "}
              {selectedRestaurant?.name || "Tất cả chi nhánh"}
            </span>
          </div>
        </div>

        {/* Header Controls (POS btn, Export btn, Select Box) */}
        <div className="controls-group">
          <Header
            selectedRestaurant={selectedRestaurant}
            onRestaurantChange={handleRestaurantChange}
            onSwitchToPOS={handleSwitchToPOS}
            onGenerateReport={handleGenerateReport}
          />
        </div>
      </div>

      {/* 2. Stats Grid (Thống kê 4 ô) */}
      <div className="section-stats">
        <StatsGrid stats={stats} isLoading={loading} />
      </div>

      {/* 3. Quick Actions (Thanh thao tác nhanh) */}
      <div className="section-quick-actions">
        <QuickActions />
      </div>

      {/* 4. Main Content Grid (Layout 70/30) */}
      <div className="dashboard-layout-grid">
        {/* Cột trái (Lớn): Biểu đồ & Đơn hàng mới */}
        <div className="main-column">
          <div className="chart-wrapper">
            {/* Component Biểu đồ doanh thu */}
            <RevenueChart />
          </div>

          <div className="recent-orders-wrapper-container">
            {/* Component Đơn hàng gần đây */}
            <RecentOrders />
          </div>
        </div>

        {/* Cột phải (Nhỏ): Món bán chạy & Thông báo/Khác */}
        <div className="side-column">
          {/* Component Top món ăn */}
          <TopDishes />

          {/* Nếu có ActivityFeed hoặc Notifications thì đặt ở đây */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
