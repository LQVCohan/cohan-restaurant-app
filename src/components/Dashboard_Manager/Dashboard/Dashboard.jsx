import React, { useContext, useMemo } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Monitor,
  CalendarRange,
  Store,
  ShieldAlert,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { useDashboard } from "../../../hooks/useDashboard";
import StatsGrid from "./components/StatsGrid";
import RevenueChart from "./components/RevenueChart";
import RecentOrders from "./components/RecentOrders";
import TopDishes from "./components/TopDishes";
import ManagerPerformancePanel from "../Performance/ManagerPerformancePanel";
import "./Dashboard.scss";

const RANGE_LABELS = { week: "7 ngày gần nhất", month: "30 ngày gần nhất" };

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
    const fullName = user?.fullName || user?.name || "Quản lý";
    return `Xin chào, ${fullName}`;
  }, [user]);

  const rangeLabel = RANGE_LABELS[range] || "7 ngày gần nhất";
  const processingOrders =
    (stats?.statusCounts?.pending || 0) + (stats?.statusCounts?.preparing || 0);
  const alertsCount = safeLowStockItems.length;

  return (
    <main className="manager-dashboard">
      <section
        className="dashboard-compact-header"
        aria-labelledby="dashboard-title"
      >
        <div>
          <p className="dashboard-compact-header__greeting">{greetingText}</p>
          <h1 id="dashboard-title">Dashboard quản lý</h1>
          <p className="dashboard-compact-header__subtitle">
            Theo dõi vận hành, đơn hàng và hiệu suất nhà hàng.
          </p>
        </div>

        <div className="dashboard-compact-header__actions">
          <button
            type="button"
            className="dashboard-btn dashboard-btn--ghost"
            onClick={() => handleGenerateReport?.()}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            className="dashboard-btn dashboard-btn--primary"
            onClick={() => handleSwitchToPOS?.()}
          >
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
          <button
            type="button"
            className="dashboard-btn dashboard-btn--ghost"
            onClick={() => handleGenerateReport?.()}
          >
            Thử lại
          </button>
        </section>
      ) : null}

      <StatsGrid
        stats={{ ...stats, processing: processingOrders, alerts: alertsCount }}
        isLoading={loading}
        variant="summary"
        alertsCount={alertsCount}
      />

      <section className="dashboard-workspace">
        <div className="dashboard-workspace__main">
          <article className="dashboard-card">
            <div className="dashboard-card__head">
              <div>
                <h3>Doanh thu</h3>
                <p>Theo dõi xu hướng doanh thu theo khoảng thời gian.</p>
              </div>
              <span className="dashboard-mini-badge">{rangeLabel}</span>
            </div>
            <RevenueChart data={safeRevenueTrend} loading={loading} />
          </article>

          <article className="dashboard-card dashboard-card--orders">
            <div className="dashboard-card__head">
              <div>
                <h3>Đơn hàng gần đây</h3>
                <p>Theo dõi trạng thái xử lý các đơn gần nhất.</p>
              </div>
            </div>
            <RecentOrders orders={safeRecentOrders} loading={loading} variant="bare" />
          </article>
        </div>

        <aside className="dashboard-workspace__side">
          <article className="dashboard-card">
            <div className="dashboard-card__head">
              <h3>Cảnh báo vận hành</h3>
            </div>

            {safeLowStockItems.length > 0 ? (
              <div className="operational-alerts">
                {safeLowStockItems.slice(0, 3).map((item, index) => (
                  <div
                    className="operational-alert"
                    key={`${item.id || item.name}-${index}`}
                  >
                    <ShieldAlert size={16} />
                    <div>
                      <p>Tồn kho thấp</p>
                      <span>
                        {item.name || "Nguyên liệu"}: {item.onHand ?? 0}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty dashboard-empty--compact">
                <h4>Vận hành ổn định</h4>
                <p>Chưa có cảnh báo quan trọng.</p>
              </div>
            )}
          </article>

          <article className="dashboard-card">
            <ManagerPerformancePanel
              restaurantId={selectedRestaurantId}
              summaryOnly
              showViewAll
            />
          </article>

          <article className="dashboard-card">
            <div className="dashboard-card__head">
              <h3>Món bán chạy</h3>
            </div>
            <TopDishes data={safeTopDishes} loading={loading} variant="bare" />
          </article>
        </aside>
      </section>

      <StatsGrid stats={stats} isLoading={loading} variant="compact" />
    </main>
  );
};

export default Dashboard;
