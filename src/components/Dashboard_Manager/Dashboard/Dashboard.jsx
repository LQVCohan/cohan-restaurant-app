import React, { useContext, useMemo } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Monitor,
  CalendarRange,
  Store,
  ShieldAlert,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { useDashboard } from "../../../hooks/useDashboard";
import { useDashboardActionQueue } from "../../../hooks/useDashboardActionQueue";
import useSocketOrder from "../../../hooks/useSocketOrder";
import StatsGrid from "./components/StatsGrid";
import RevenueChart from "./components/RevenueChart";
import RecentOrders from "./components/RecentOrders";
import TopDishes from "./components/TopDishes";
import DashboardActionQueue from "./components/DashboardActionQueue";
import DashboardSupportQueue from "./components/DashboardSupportQueue";
import ManagerPerformancePanel from "../Performance/ManagerPerformancePanel";
import "./Dashboard.scss";
import "./DashboardEmptyState.scss";

const RANGE_LABELS = {
  week: "7 ngày gần nhất",
  month: "30 ngày gần nhất",
};

const Dashboard = ({ staffRoster = null }) => {
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
    restaurantsLoading,
    error,
    range,
    setRange,
    revenueTrend,
    recentOrders,
    topDishes,
    lowStockItems,
    pendingOrders,
    pendingReservations,
    pendingSupportRequests,
    pendingOrderCount,
    pendingReservationCount,
    pendingSupportRequestCount,
    refetchDashboard,
  } = useDashboard();

  const dashboardQueue = useDashboardActionQueue({
    restaurantId: selectedRestaurantId,
    refetchDashboard,
  });

  useSocketOrder(selectedRestaurantId, {
    onTableCustomerRequestCreated: () => refetchDashboard?.(),
    onTablePaymentRequested: () => refetchDashboard?.(),
  });

  const safeRevenueTrend = Array.isArray(revenueTrend) ? revenueTrend : [];
  const safeRecentOrders = Array.isArray(recentOrders) ? recentOrders : [];
  const safeTopDishes = Array.isArray(topDishes) ? topDishes : [];
  const safeLowStockItems = Array.isArray(lowStockItems) ? lowStockItems : [];
  const safePendingOrders = Array.isArray(pendingOrders) ? pendingOrders : [];
  const safePendingReservations = Array.isArray(pendingReservations)
    ? pendingReservations
    : [];
  const safePendingSupportRequests = Array.isArray(pendingSupportRequests)
    ? pendingSupportRequests
    : [];

  const hasRevenue = safeRevenueTrend.some(
    (item) => Number(item?.current || 0) > 0,
  );
  const greetingText = useMemo(
    () => `Xin chào, ${user?.fullName || user?.name || "Quản lý"}`,
    [user],
  );
  const rangeLabel = RANGE_LABELS[range] || RANGE_LABELS.week;
  const alertsCount = safeLowStockItems.length;
  const resourceCounts = {
    customers: Number(stats?.customers || 0),
    tables: Number(stats?.tables || 0),
    menuItems: Number(stats?.menuItems || 0),
    promotions: Number(stats?.promotions || 0),
    staff: Number(stats?.staff || 0),
  };
  const hasRestaurants = (restaurants || []).length > 0;
  const hasSelectedRestaurant = Boolean(
    selectedRestaurantId || selectedRestaurant?.id,
  );
  const showNoRestaurantState = !restaurantsLoading && !hasRestaurants;
  const hasRestaurantContext = hasSelectedRestaurant || hasRestaurants;
  const isResourceSetupEmpty =
    !loading &&
    hasRestaurantContext &&
    Object.values(resourceCounts).every((value) => value === 0);
  const hasCompletedOrders = Number(stats?.statusCounts?.completed || 0) > 0;
  const effectiveRestaurantId =
    selectedRestaurantId || selectedRestaurant?.id || "";
  const alertsCardState = loading
    ? "loading"
    : alertsCount > 0
      ? "warning"
      : "healthy";

  const navigateManagerPage = (page, query = {}) => {
    if (!page || typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("manager:navigate", {
        detail: { page, query, source: "dashboard" },
      }),
    );
    if (window.location.hash !== `#${page}`) {
      window.location.hash = page;
    }
  };

  const handleGoToMenu = () => navigateManagerPage("menu");
  const handleGoToTables = () => navigateManagerPage("tables");
  const handleGoToStaff = () => navigateManagerPage("staff");
  const handleGoToOrders = () => navigateManagerPage("orders");
  const handleGoToHandoff = () => navigateManagerPage("ai-handoff");
  const handleGoToRestaurantInfo = () =>
    navigateManagerPage("restaurant-info-management");
  const handleGoToBrands = () => navigateManagerPage("brands");

  return (
    <div className={`manager-dashboard ${showNoRestaurantState ? "manager-dashboard--no-restaurant" : ""} ${isResourceSetupEmpty ? "manager-dashboard--setup-empty" : ""}`}>
      <section
        className="dashboard-compact-header"
        aria-labelledby="dashboard-title"
      >
        <div>
          <p className="dashboard-compact-header__greeting">{greetingText}</p>
          <h1 id="dashboard-title">Tổng quan quản lý</h1>
          <p className="dashboard-compact-header__subtitle">
            Theo dõi nhanh doanh thu, đơn hàng, tồn kho và hiệu suất trong ca.
          </p>
        </div>

        <div className="dashboard-compact-header__actions">
          <button
            type="button"
            className="dashboard-btn dashboard-btn--ghost"
            onClick={() => handleGenerateReport?.()}
            disabled={loading || showNoRestaurantState}
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
            <span>Làm mới</span>
          </button>
          <button
            type="button"
            className="dashboard-btn dashboard-btn--primary"
            onClick={() => handleSwitchToPOS?.()}
            disabled={
              !hasSelectedRestaurant ||
              typeof handleSwitchToPOS !== "function"
            }
          >
            <Monitor size={16} />
            <span>Mở bán hàng</span>
          </button>
        </div>
      </section>

      <section
        className="dashboard-filterbar"
        aria-label="Bộ lọc tổng quan vận hành"
      >
        <label className="dashboard-field">
          <span>Nhà hàng</span>
          <div className="dashboard-field__control">
            <Store size={15} />
            <select
              aria-label="Chọn nhà hàng"
              value={selectedRestaurantId || ""}
              onChange={(event) =>
                handleRestaurantChange?.(event.target.value)
              }
              disabled={loading || restaurantsLoading || !hasRestaurants}
            >
              {hasRestaurants ? (
                (restaurants || []).map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))
              ) : restaurantsLoading ? (
                <option value="" disabled>
                  Đang tải nhà hàng...
                </option>
              ) : (
                <option value="" disabled>
                  Chưa có chi nhánh khả dụng
                </option>
              )}
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
              onChange={(event) => setRange?.(event.target.value)}
              disabled={!hasSelectedRestaurant}
            >
              <option value="week">7 ngày gần nhất</option>
              <option value="month">30 ngày gần nhất</option>
            </select>
          </div>
        </label>

        <div className="dashboard-filterbar__context" aria-live="polite">
          <span>
            {hasSelectedRestaurant ? "Tự động cập nhật" : "Trạng thái dữ liệu"}
          </span>
          <strong>
            {hasSelectedRestaurant ? "Mỗi 30 giây" : "Chờ chi nhánh"}
          </strong>
        </div>
      </section>

      {error && !showNoRestaurantState ? (
        <section className="dashboard-error" role="alert">
          <AlertTriangle size={18} />
          <div>
            <h3>Không thể tải dữ liệu tổng quan</h3>
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

      {showNoRestaurantState ? (
        <section
          className="dashboard-no-restaurant"
          aria-labelledby="dashboard-no-restaurant-title"
        >
          <div className="dashboard-no-restaurant__icon" aria-hidden="true">
            <Store size={24} />
          </div>
          <div className="dashboard-no-restaurant__content">
            <p className="dashboard-no-restaurant__eyebrow">
              Cần hoàn tất chi nhánh
            </p>
            <h2 id="dashboard-no-restaurant-title">
              Chưa tìm thấy nhà hàng trong thương hiệu hiện tại
            </h2>
            <p>
              Chi nhánh chính là nhà hàng đang vận hành. Nếu bạn vừa đăng ký
              thương hiệu, hãy kiểm tra danh sách chi nhánh hoặc tạo chi nhánh
              đầu tiên để trang tổng quan có dữ liệu.
            </p>
          </div>
          <div className="dashboard-no-restaurant__actions">
            <button
              type="button"
              className="dashboard-btn dashboard-btn--ghost"
              onClick={handleGoToBrands}
            >
              Kiểm tra thương hiệu
            </button>
            <button
              type="button"
              className="dashboard-btn dashboard-btn--primary"
              onClick={handleGoToRestaurantInfo}
            >
              Mở thông tin nhà hàng
            </button>
          </div>
        </section>
      ) : (
        <>
          <DashboardActionQueue
            orders={safePendingOrders}
            reservations={safePendingReservations}
            counts={{
              orders: pendingOrderCount,
              reservations: pendingReservationCount,
            }}
            loading={loading}
            error={error}
            busyKey={dashboardQueue.busyKey}
            onConfirmOrder={dashboardQueue.confirmOrder}
            onRejectOrder={dashboardQueue.rejectOrder}
            onConfirmReservation={dashboardQueue.confirmReservation}
            onCancelReservation={dashboardQueue.cancelReservation}
            onOpenOrders={handleGoToOrders}
            onOpenTables={handleGoToTables}
          />

          <section
            className="dashboard-system-overview"
            aria-labelledby="dashboard-system-overview-title"
          >
            <div className="dashboard-section-title">
              <h2 id="dashboard-system-overview-title">
                Thông tin vận hành
              </h2>
              <p>Tổng hợp nhanh dữ liệu cơ bản của nhà hàng.</p>
            </div>
            <StatsGrid stats={stats} isLoading={loading} variant="compact" />
          </section>

          <section
            className="dashboard-operations-grid"
            aria-label="Khu vực vận hành chính"
          >
            <div className="dashboard-main-stack">
              <article className="dashboard-card dashboard-card--primary-orders dashboard-card--recent-orders">
                <div className="dashboard-card__head dashboard-card__head--compact">
                  <div>
                    <h3>Đơn hàng gần đây</h3>
                    <p>Các đơn hàng mới nhất và trạng thái xử lý.</p>
                  </div>
                  {safeRecentOrders.length > 0 ? (
                    <span className="orders-pill">
                      {Math.min(safeRecentOrders.length, 6)} đơn gần nhất
                    </span>
                  ) : null}
                </div>
                <RecentOrders
                  orders={safeRecentOrders}
                  loading={loading}
                  variant="bare"
                  onOpenPOS={handleSwitchToPOS}
                />
              </article>

              <div className="dashboard-main-secondary">
                <article className="dashboard-card dashboard-card--dense">
                  <div className="dashboard-card__head dashboard-card__head--compact">
                    <div>
                      <h3>Món bán chạy</h3>
                      <p>Các món bán nhiều nhất trong thời gian đã chọn.</p>
                    </div>
                  </div>
                  <TopDishes
                    data={safeTopDishes}
                    loading={loading}
                    variant="bare"
                    compactWhenEmpty
                    hasCompletedOrders={hasCompletedOrders}
                  />
                </article>

                <article className="dashboard-card dashboard-card--dense dashboard-card--performance-summary">
                  <ManagerPerformancePanel
                    restaurantId={effectiveRestaurantId}
                    restaurantLoading={loading}
                    summaryOnly
                    showViewAll
                    compactWhenHealthy
                  />
                </article>
              </div>
            </div>

            <aside
              className="dashboard-side-stack"
              aria-label="Trạng thái vận hành và cảnh báo"
            >
              {staffRoster ? (
                <div className="dashboard-staff-roster-slot">
                  {staffRoster}
                </div>
              ) : null}
              <DashboardSupportQueue
                requests={safePendingSupportRequests}
                count={pendingSupportRequestCount}
                loading={loading}
                error={error}
                busyKey={dashboardQueue.busyKey}
                onAcknowledge={dashboardQueue.acknowledgeSupport}
                onResolve={dashboardQueue.resolveSupport}
                onOpenHandoff={handleGoToHandoff}
              />

              <article
                className={`dashboard-card dashboard-card--side dashboard-card--alerts dashboard-card--alerts-${alertsCardState}`}
              >
                <div className="dashboard-card__head dashboard-card__head--compact">
                  <div>
                    <h3>Cảnh báo vận hành</h3>
                    <p>Các vấn đề về tồn kho hoặc vận hành cần kiểm tra.</p>
                  </div>
                  <span
                    className={`alert-count alert-count--${alertsCardState}`}
                  >
                    {loading ? "Đang kiểm tra" : `${alertsCount} cảnh báo`}
                  </span>
                </div>

                {loading ? (
                  <div className="dashboard-empty dashboard-empty--compact dashboard-empty--loading">
                    <h4>Đang tải cảnh báo</h4>
                    <p>Đang kiểm tra tồn kho và trạng thái vận hành.</p>
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
                            {item.name || "Chưa cập nhật tên mặt hàng"} — Còn
                            lại: {item.onHand ?? 0}
                          </span>
                        </div>
                      </div>
                    ))}
                    {safeLowStockItems.length > 3 ? (
                      <p className="operational-alerts__more">
                        Còn {safeLowStockItems.length - 3} cảnh báo khác trong
                        kho.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="dashboard-empty dashboard-empty--compact dashboard-empty--healthy">
                    <h4>Vận hành ổn định</h4>
                    <p>Không có cảnh báo quan trọng.</p>
                  </div>
                )}
              </article>

              <article className="dashboard-card dashboard-card--side dashboard-card--revenue">
                <div className="dashboard-card__head dashboard-card__head--compact">
                  <div>
                    <h3>Xu hướng doanh thu</h3>
                    <p>{rangeLabel}</p>
                  </div>
                </div>

                {loading ? (
                  <div
                    className="revenue-compact-empty"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="revenue-compact-empty__icon">
                      <ClipboardList size={16} />
                    </div>
                    <div
                      className="revenue-compact-skeleton"
                      aria-hidden="true"
                    >
                      <span />
                      <span />
                      <span />
                    </div>
                    <p className="revenue-compact-empty__text">
                      Đang tải dữ liệu doanh thu...
                    </p>
                  </div>
                ) : hasRevenue ? (
                  <RevenueChart
                    data={safeRevenueTrend}
                    loading={loading}
                    compact
                  />
                ) : (
                  <div
                    className="revenue-compact-empty revenue-compact-empty--simple"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="revenue-compact-empty__icon">
                      <TrendingUp size={16} />
                    </div>
                    <p className="revenue-compact-empty__text">
                      Chưa có doanh thu trong khoảng thời gian này.
                    </p>
                  </div>
                )}
              </article>
            </aside>
          </section>

          {isResourceSetupEmpty ? (
            <section
              className="dashboard-setup-hint"
              aria-label="Gợi ý thiết lập dữ liệu vận hành"
            >
              <div>
                <p className="dashboard-setup-hint__eyebrow">
                  Thiết lập vận hành
                </p>
                <h3>Bổ sung dữ liệu để theo dõi vận hành chính xác hơn</h3>
                <p>
                  Hãy thêm bàn, thực đơn và nhân viên để hệ thống có thể ghi
                  nhận đơn hàng, doanh thu và hiệu suất chính xác.
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
                  aria-label="Đi tới trang quản lý thực đơn để thêm món"
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
        </>
      )}
    </div>
  );
};

export default Dashboard;
