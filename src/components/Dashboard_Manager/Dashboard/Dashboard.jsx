import React, { useContext, useMemo } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Monitor,
  CalendarRange,
  Store,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { useDashboard } from "../../../hooks/useDashboard";

import StatsGrid from "./components/StatsGrid";
import RevenueChart from "./components/RevenueChart";
import RecentOrders from "./components/RecentOrders";
import TopDishes from "./components/TopDishes";
import ManagerPerformancePanel from "../Performance/ManagerPerformancePanel";

import "./Dashboard.scss";

const RANGE_LABELS = {
  week: "7 ngày gần nhất",
  month: "30 ngày gần nhất",
};

const Dashboard = () => {
  const { user } = useContext(AuthContext);
  const {
    selectedRestaurant,
    restaurants,
    selectedRestaurantId,
    stats,
    handleRestaurantChange,
    handleSwitchToPOS,
    handleGenerateReport,
    loading,
    error,
    range,
    setRange,
    revenueTrend,
    recentOrders,
    topDishes,
    lowStockItems,
  } = useDashboard();

  const safeRevenueTrend = Array.isArray(revenueTrend) ? revenueTrend : [];
  const safeRecentOrders = Array.isArray(recentOrders) ? recentOrders : [];
  const safeTopDishes = Array.isArray(topDishes) ? topDishes : [];
  const safeLowStockItems = Array.isArray(lowStockItems) ? lowStockItems : [];

  const greetingText = useMemo(() => {
    const fullName =
      user?.fullName || user?.name || user?.role?.name || user?.roleName || "";
    return fullName ? `Xin chào, ${fullName}` : "Tổng quan vận hành";
  }, [user]);

  const rangeLabel = RANGE_LABELS[range] || "7 ngày gần nhất";

  return (
    <div className="manager-dashboard">
      <section className="dashboard-hero" aria-labelledby="dashboard-title">
        <div className="dashboard-hero__main">
          <p className="dashboard-hero__greeting">{greetingText}</p>
          <h1 id="dashboard-title">Dashboard quản lý</h1>
          <p className="dashboard-hero__subtitle">
            Theo dõi doanh thu, đơn hàng và tình hình vận hành nhà hàng trong thời gian thực.
          </p>
          <span className="dashboard-hero__badge">Đang xem: {rangeLabel}</span>
        </div>

        <div className="dashboard-hero__actions">
          <button type="button" className="dashboard-btn dashboard-btn--ghost" onClick={() => handleGenerateReport?.()} disabled={loading}>
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            <span>Làm mới</span>
          </button>
          <button type="button" className="dashboard-btn dashboard-btn--primary" onClick={() => handleSwitchToPOS?.()}>
            <Monitor size={16} />
            <span>Mở POS</span>
          </button>
        </div>
      </section>

      <section className="dashboard-filterbar" aria-label="Bộ lọc dashboard">
        <label className="dashboard-field">
          <span>Nhà hàng</span>
          <div className="dashboard-field__control">
            <Store size={15} />
            <select
              aria-label="Chọn nhà hàng"
              value={selectedRestaurantId || ""}
              onChange={(e) => handleRestaurantChange?.(e.target.value)}
            >
              {(restaurants || []).map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="dashboard-field">
          <span>Khoảng thời gian</span>
          <div className="dashboard-field__control">
            <CalendarRange size={15} />
            <select
              aria-label="Chọn khoảng thời gian"
              value={range}
              onChange={(e) => setRange?.(e.target.value)}
            >
              <option value="week">7 ngày gần nhất</option>
              <option value="month">30 ngày gần nhất</option>
            </select>
          </div>
        </label>

        <div className="dashboard-filterbar__context">
          <span>Đang xem:</span>
          <strong>{selectedRestaurant?.name || "Toàn hệ thống"}</strong>
        </div>
      </section>

      {error ? (
        <section className="dashboard-error" role="alert">
          <AlertTriangle size={18} />
          <div>
            <h3>Không thể tải dữ liệu dashboard</h3>
            <p>{error?.message || "Vui lòng thử lại sau."}</p>
          </div>
          <button type="button" className="dashboard-btn dashboard-btn--ghost" onClick={() => handleGenerateReport?.()}>
            Thử lại
          </button>
        </section>
      ) : null}

      <section className="dashboard-section">
        <div className="dashboard-section__head">
          <h2>Tổng quan vận hành</h2>
        </div>
        <div className="dashboard-kpi-grid">
          <StatsGrid stats={stats} isLoading={loading} />
        </div>
      </section>

      <section className="dashboard-main-grid">
        <article className="dashboard-card dashboard-chart-card">
          <div className="dashboard-card__head">
            <div>
              <h3>Doanh thu</h3>
              <p>Xu hướng doanh thu theo khoảng thời gian đã chọn</p>
            </div>
            <span className="dashboard-mini-badge">{rangeLabel}</span>
          </div>
          {loading ? <div className="dashboard-skeleton dashboard-skeleton--chart" /> : null}
          {!loading && safeRevenueTrend.length > 0 ? (
            <RevenueChart data={safeRevenueTrend} loading={loading} />
          ) : null}
        </article>

        <article className="dashboard-card dashboard-summary-card">
          <div className="dashboard-card__head">
            <div>
              <h3>Hiệu suất vận hành</h3>
              <p>Thông tin vận hành theo nhà hàng đã chọn</p>
            </div>
          </div>
          <ManagerPerformancePanel restaurantId={selectedRestaurantId} summaryOnly showViewAll />
        </article>
      </section>

      <section className="dashboard-list-grid">
        <article className="dashboard-card dashboard-list-card">
          <div className="dashboard-card__head">
            <div>
              <h3>Đơn hàng gần đây</h3>
              <p>Theo dõi các đơn mới và trạng thái xử lý</p>
            </div>
          </div>
          <RecentOrders orders={safeRecentOrders} loading={loading} variant="bare" />
        </article>

        <article className="dashboard-card dashboard-list-card">
          <div className="dashboard-card__head">
            <div>
              <h3>Món bán chạy</h3>
              <p>Các món có doanh số tốt nhất</p>
            </div>
          </div>
          <TopDishes data={safeTopDishes} lowStockItems={safeLowStockItems} loading={loading} variant="bare" />
        </article>
      </section>
    </div>
  );
};

export default Dashboard;
