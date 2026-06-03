import React, { useContext, useMemo } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Monitor,
  CalendarRange,
  Store,
  ShieldAlert,
  CircleCheck,
  ClipboardList,
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
const formatCurrency = (val) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(val || 0));

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
  const hasRevenue = safeRevenueTrend.some(
    (item) => Number(item?.current || 0) > 0,
  );

  const greetingText = useMemo(() => {
    const fullName = user?.fullName || user?.name || "Quản lý";
    return `Xin chào, ${fullName}`;
  }, [user]);

  const rangeLabel = RANGE_LABELS[range] || "7 ngày gần nhất";
  const processingOrders =
    (stats?.statusCounts?.pending || 0) + (stats?.statusCounts?.preparing || 0);
  const alertsCount = safeLowStockItems.length;
  const resourceCounts = {
    customers: Number(stats?.customers || 0),
    tables: Number(stats?.tables || 0),
    menuItems: Number(stats?.menuItems || 0),
    promotions: Number(stats?.promotions || 0),
    staff: Number(stats?.staff || 0),
  };
  const hasRestaurantContext =
    Boolean(selectedRestaurantId || selectedRestaurant?.id) ||
    (restaurants || []).length > 0;
  const isResourceSetupEmpty =
    !loading &&
    hasRestaurantContext &&
    resourceCounts.customers === 0 &&
    resourceCounts.tables === 0 &&
    resourceCounts.menuItems === 0 &&
    resourceCounts.promotions === 0 &&
    resourceCounts.staff === 0;
  const hasCompletedOrders = Number(stats?.statusCounts?.completed || 0) > 0;
  const effectiveRestaurantId = selectedRestaurantId || selectedRestaurant?.id || "";
  const alertsCardState = loading
    ? "loading"
    : alertsCount > 0
      ? "warning"
      : "healthy";

  const navigateManagerPage = (page) => {
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: {
          page,
          source: "dashboard-empty-state",
        },
      }),
    );
  };

  const handleGoToMenu = () => navigateManagerPage("menu");
  const handleGoToTables = () => navigateManagerPage("tables");
  const handleGoToStaff = () => navigateManagerPage("staff");

  return (
    <div className="manager-dashboard">
      <section
        className="dashboard-compact-header"
        aria-labelledby="dashboard-title"
      >
        <div>
          <p className="dashboard-compact-header__greeting">{greetingText}</p>
          <h1 id="dashboard-title">Dashboard quản lý</h1>
          <p className="dashboard-compact-header__subtitle">
            Trung tâm điều hành ca làm: doanh thu, đơn đang xử lý, tồn kho và hiệu suất.
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
            disabled={typeof handleSwitchToPOS !== "function"}
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

        <div className="dashboard-filterbar__context" aria-live="polite">
          <span>Đang xem</span>
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

      <section className="dashboard-operations-grid" aria-label="Khu vực vận hành chính">
        <article className="dashboard-card dashboard-card--primary-orders">
          <div className="dashboard-card__head">
            <div>
              <h3>Đơn hàng gần đây</h3>
              <p>Theo dõi trạng thái xử lý các đơn gần nhất.</p>
            </div>
            {safeRecentOrders.length > 0 ? (
              <span className="orders-pill">
                Hiển thị {Math.min(safeRecentOrders.length, 6)} đơn gần nhất
              </span>
            ) : null}
          </div>
          <RecentOrders
            orders={safeRecentOrders}
            loading={loading}
            variant="bare"
            onOpenPOS={handleSwitchToPOS}
            onGoToMenu={handleGoToMenu}
            onGoToTables={handleGoToTables}
          />
        </article>

        <aside className="dashboard-side-stack" aria-label="Trạng thái vận hành và cảnh báo">
          <article className={`dashboard-card dashboard-card--side dashboard-card--alerts dashboard-card--alerts-${alertsCardState}`}>
            <div className="dashboard-card__head">
              <div>
                <h3>Cảnh báo vận hành</h3>
                <p>Tồn kho và tín hiệu cần chú ý trong ca.</p>
              </div>
              <span className={`alert-count alert-count--${alertsCardState}`}>
                {loading ? "Đang kiểm" : `${alertsCount} cảnh báo`}
              </span>
            </div>
            {loading ? (
              <div className="dashboard-empty dashboard-empty--compact dashboard-empty--loading">
                <h4>Đang tải cảnh báo</h4>
                <p>Đang kiểm tra tồn kho và các cảnh báo vận hành.</p>
              </div>
            ) : safeLowStockItems.length > 0 ? (
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
                {safeLowStockItems.length > 3 ? (
                  <p className="operational-alerts__more">
                    Còn {safeLowStockItems.length - 3} cảnh báo khác trong kho.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="dashboard-empty dashboard-empty--compact dashboard-empty--healthy">
                <h4>Vận hành ổn định</h4>
                <p>Chưa có cảnh báo quan trọng.</p>
              </div>
            )}
          </article>

          <article className="dashboard-card dashboard-card--side dashboard-card--revenue">
            <div className="dashboard-card__head">
              <div>
                <h3>Doanh thu</h3>
                <p>{rangeLabel}</p>
              </div>
            </div>
            {loading ? (
              <div className="revenue-compact-empty" role="status" aria-live="polite">
                <div className="revenue-compact-empty__icon">
                  <ClipboardList size={16} />
                </div>
                <div className="revenue-compact-skeleton" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <p className="revenue-compact-empty__text">Đang tải dữ liệu doanh thu...</p>
              </div>
            ) : hasRevenue ? (
              <RevenueChart data={safeRevenueTrend} loading={loading} compact />
            ) : (
              <div className="revenue-compact-empty" role="status" aria-live="polite">
                <div className="revenue-compact-empty__icon">
                  <CircleCheck size={16} />
                </div>
                <p className="revenue-compact-empty__value">{formatCurrency(0)}</p>
                <p className="revenue-compact-empty__text">
                  Chưa có doanh thu trong khoảng thời gian này.
                </p>
              </div>
            )}
          </article>

          <article className="dashboard-card dashboard-card--side">
            <ManagerPerformancePanel
              restaurantId={effectiveRestaurantId}
              restaurantLoading={loading}
              summaryOnly
              showViewAll
              compactWhenHealthy
            />
          </article>

          <article className="dashboard-card dashboard-card--side">
            <div className="dashboard-card__head">
              <h3>Món bán chạy</h3>
            </div>
            <TopDishes
              data={safeTopDishes}
              loading={loading}
              variant="bare"
              compactWhenEmpty
              hasCompletedOrders={hasCompletedOrders}
            />
          </article>
        </aside>
      </section>

      {isResourceSetupEmpty ? (
        <section
          className="dashboard-setup-hint"
          aria-label="Gợi ý thiết lập dữ liệu vận hành"
        >
          <div>
            <p className="dashboard-setup-hint__eyebrow">Thiết lập vận hành</p>
            <h3>Thêm dữ liệu nền để dashboard hữu ích hơn</h3>
            <p>
              Bắt đầu bằng bàn, menu và nhân sự để hệ thống có thể ghi nhận đơn
              hàng, doanh thu và hiệu suất chính xác.
            </p>
          </div>

          <div className="dashboard-setup-hint__actions">
            <button
              type="button"
              onClick={handleGoToTables}
              aria-label="Đi tới trang quản lý bàn để thêm bàn"
            >
              Thêm bàn
            </button>
            <button
              type="button"
              onClick={handleGoToMenu}
              aria-label="Đi tới trang quản lý menu để thêm món"
            >
              Thêm món
            </button>
            <button
              type="button"
              onClick={handleGoToStaff}
              aria-label="Đi tới trang quản lý nhân viên để thêm nhân viên"
            >
              Thêm nhân viên
            </button>
          </div>
        </section>
      ) : null}

      <StatsGrid stats={stats} isLoading={loading} variant="compact" />
    </div>
  );
};

export default Dashboard;
