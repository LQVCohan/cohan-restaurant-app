import React, { useMemo } from "react";
import { Calendar, MapPin, Search } from "lucide-react";
import { useDashboard } from "../../../hooks/useDashboard";

// Components (Đã được nâng cấp ở các bước trước)
import Header from "./components/Header"; // Tên mới cho component Header cũ
import StatsGrid from "./components/StatsGrid";
import RevenueChart from "./components/RevenueChart";
import RecentOrders from "./components/RecentOrders"; // Giả định đã có
import TopDishes from "./components/TopDishes";
import QuickActions from "./components/QuickActions"; // Component mới bên dưới

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

  // 1. Logic Lời chào thông minh
  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours();
    let text = "Chào buổi tối";
    if (hour < 12) text = "Chào buổi sáng";
    else if (hour < 18) text = "Chào buổi chiều";

    const dateStr = new Date().toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return { text, dateStr };
  }, []);

  return (
    <div className="dashboard-container fade-in">
      {/* SECTION 1: TOP BAR (Sticky Header) */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="greeting">
            {greetingInfo.text}, <span className="highlight">Admin</span>
          </h1>
          <div className="meta-info">
            <span className="meta-item">
              <Calendar size={14} /> {greetingInfo.dateStr}
            </span>
            <span className="meta-item">
              <MapPin size={14} /> {selectedRestaurant?.name || "Toàn hệ thống"}
            </span>
          </div>
        </div>

        <div className="header-right">
          {/* Thanh tìm kiếm nhanh */}
          <div className="search-bar">
            <Search size={18} />
            <input type="text" placeholder="Tìm đơn hàng, món ăn..." />
          </div>

          {/* Các nút chức năng (POS, Export...) */}
          <Header
            selectedRestaurant={selectedRestaurant}
            onRestaurantChange={handleRestaurantChange}
            onSwitchToPOS={handleSwitchToPOS}
            onGenerateReport={handleGenerateReport}
          />
        </div>
      </header>

      {/* SECTION 2: STATS OVERVIEW */}
      <section className="stats-section">
        <StatsGrid stats={stats} isLoading={loading} />
      </section>

      {/* SECTION 3: MAIN GRID (BENTO LAYOUT) */}
      <section className="main-content-grid">
        {/* LEFT COLUMN (70%) - Dữ liệu chi tiết & Rộng */}
        <div className="col-primary">
          <div className="widget-wrapper chart-widget">
            <RevenueChart />
          </div>
          <div className="widget-wrapper orders-widget">
            {/* Truyền prop scrollable để table cuộn trong khung */}
            <RecentOrders scrollable={true} />
          </div>
        </div>

        {/* RIGHT COLUMN (30%) - Thông tin bổ trợ & Thao tác */}
        <div className="col-secondary">
          <div className="widget-wrapper actions-widget">
            <QuickActions />
          </div>
          <div className="widget-wrapper dishes-widget">
            <TopDishes />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
