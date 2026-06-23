import React, { useMemo } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock3,
  Download,
  DollarSign,
  Megaphone,
  PackageSearch,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Users,
} from "lucide-react";
import { useAnalyst } from "../../../hooks/useAnalyst";
import KPIInsightCard from "./components/KPIInsightCard";
import RevenueAnalyticsChart from "./components/RevenueAnalyticsChart";
import MenuEngineeringMatrix from "./components/MenuEngineeringMatrix";
import SmartFeedbackAnalysis from "./components/SmartFeedbackAnalysis";
import SmartOccupancyHeatmap from "./components/SmartOccupancyHeatmap";
import StaffPerformance from "./components/StaffPerformance";
import DemandForecastWidget from "./components/DemandForecastWidget";
import StaffSchedulingAssistantWidget from "./components/StaffSchedulingAssistantWidget";
import MenuEngineeringAssistantWidget from "./components/MenuEngineeringAssistantWidget";
import SmartPromotionEngineWidget from "./components/SmartPromotionEngineWidget";
import "./ManagerAnalyst.scss";
import "./ManagerAnalystPolish.scss";

const formatVnd = (value) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
const clamp = (value) => Math.max(0, Math.min(100, Number(value || 0)));

const calculateTrendProgress = (trend = []) => {
  const totals = trend.reduce(
    (acc, row) => ({
      current: acc.current + Number(row?.current || 0),
      previous: acc.previous + Number(row?.previous || 0),
    }),
    { current: 0, previous: 0 }
  );

  if (!totals.previous) return null;
  return clamp((totals.current / totals.previous) * 100);
};

const REQUEST_STATUS_LABELS = {
  PENDING: "Chờ xử lý",
  ACKNOWLEDGED: "Đã nhận",
};

const REQUEST_TYPE_LABELS = {
  PAYMENT_REQUEST: "Yêu cầu thanh toán",
  STAFF_CALL: "Gọi nhân viên",
};

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
};

const navigateManager = (page, query = {}, source = "manager-analytics") => {
  window.dispatchEvent(new CustomEvent("manager:navigate", {
    detail: { page, query, source },
  }));
};

const EmptyState = ({ icon: Icon = Sparkles, title, description, actionLabel, onAction }) => (
  <div className="analytics-empty-state">
    <span className="analytics-empty-state__icon"><Icon size={16} /></span>
    <div>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  </div>
);

const ActionCenter = ({ actions, serviceRequests, recentOrders, lowStockItems = [], loading, error, onRefreshRequests }) => {
  const queue = serviceRequests?.length ? serviceRequests.slice(0, 5) : [];
  const orderQueue = !queue.length ? recentOrders?.slice(0, 4) || [] : [];

  return (
    <div className="action-center-grid">
      <div className="action-center-panel action-center-panel--primary">
        <div className="compact-card-header">
          <div>
            <h3>Trung tâm hành động hôm nay</h3>
            <p>Các việc cần xử lý trước dựa trên đơn hàng, nhân sự, tồn kho và khuyến mãi.</p>
          </div>
          <span className="action-center-count">{actions.length} ưu tiên</span>
        </div>

        <div className="action-list">
          {actions.map((action) => (
            <article key={action.title} className={`action-card action-card--${action.level}`}>
              <span className="action-card__icon"><action.icon size={18} /></span>
              <div className="action-card__body">
                <div className="action-card__topline">
                  <span className={`priority-badge priority-badge--${action.level}`}>{action.badge}</span>
                  <small>{action.source}</small>
                </div>
                <h4>{action.title}</h4>
                <p>{action.description}</p>
                <button type="button" onClick={action.onClick}>
                  {action.cta} <ArrowRight size={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="action-center-panel action-center-panel--queue">
        <div className="compact-card-header compact-card-header--inline">
          <div>
            <h3>{queue.length ? "Hàng đợi yêu cầu khách" : "Đơn mới gần đây"}</h3>
            <p>{queue.length ? "Yêu cầu từ bàn cần phản hồi nhanh." : "Theo dõi các đơn mới để giữ nhịp vận hành."}</p>
          </div>
          <button type="button" className="ghost-refresh" onClick={onRefreshRequests} disabled={loading}>
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? <EmptyState icon={Clock3} title="Đang tải hàng đợi" description="Hệ thống đang cập nhật yêu cầu khách mới nhất." /> : null}
        {!loading && error ? <EmptyState icon={AlertTriangle} title="Chưa tải được hàng đợi" description="Kiểm tra kết nối hoặc thử làm mới lại dữ liệu yêu cầu khách." actionLabel="Thử lại" onAction={onRefreshRequests} /> : null}
        {!loading && !error && !queue.length && !orderQueue.length ? (
          <EmptyState icon={ShoppingBag} title="Chưa có việc cần xử lý" description="Không có yêu cầu khách hoặc đơn mới trong hàng đợi hiện tại." actionLabel="Xem đơn hàng" onAction={() => navigateManager("orders")} />
        ) : null}

        {!loading && !error && queue.length ? (
          <ul className="queue-list" data-testid="customer-request-list">
            {queue.map((request, idx) => (
              <li key={`${request.requestId || request.orderCode || idx}-${request.status || "unknown"}`}>
                <div className="queue-list__top">
                  <strong>{REQUEST_TYPE_LABELS[request.type] || "Yêu cầu khách"}</strong>
                  <span className={`queue-badge ${String(request.status || "").toLowerCase()}`}>{REQUEST_STATUS_LABELS[request.status] || request.status || "-"}</span>
                </div>
                <p>Bàn {request.tableCode || "Chưa rõ bàn"} • #{request.orderCode || "Chưa có mã đơn"}</p>
                {request.message ? <small>{request.message}</small> : null}
                <button type="button" className="inline-nav" onClick={() => navigateManager(request.type === "STAFF_CALL" ? "ai-handoff" : "orders", { orderId: request.orderId, requestId: request.requestId })}>Đi tới xử lý</button>
                {request.createdAt ? <time>{formatDateTime(request.createdAt)}</time> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {!loading && !error && orderQueue.length ? (
          <ul className="queue-list">
            {orderQueue.map((order, idx) => (
              <li key={order.id || `${order.orderCode || "order"}-${idx}`}>
                <div className="queue-list__top">
                  <strong>{order.orderCode ? `#${order.orderCode}` : "Đơn chưa có mã"}</strong>
                  <span className="queue-badge acknowledged">{order.status || "Mới"}</span>
                </div>
                <p>{order.customerName || "Khách lẻ"}</p>
                <small>{[formatVnd(order.total), formatDateTime(order.createdAt)].filter(Boolean).join(" • ")}</small>
                <button type="button" className="inline-nav" onClick={() => navigateManager("orders", { orderId: order.id })}>Xem đơn</button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="low-stock-compact" data-testid="low-stock-compact">
          <div className="low-stock-compact__head">
            <span><PackageSearch size={14} /> Tồn kho thấp</span>
            <strong>{lowStockItems.length}</strong>
          </div>
          {lowStockItems.length ? (
            <ul>
              {lowStockItems.slice(0, 3).map((item, idx) => (
                <li key={item.id || item._id || item.name || idx}>
                  <span>{item.name || item.ingredientName || item.itemName || "Nguyên liệu"}</span>
                  <small>{[item.currentStock ?? item.onHand, item.unit].filter(Boolean).join(" ") || "Cần kiểm tra"}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>Chưa có nguyên liệu dưới ngưỡng trong kỳ hiện tại.</p>
          )}
        </div>

        <div className="queue-actions">
          <button type="button" onClick={() => navigateManager("orders", { view: "pos" })}>Mở POS</button>
          <button type="button" onClick={() => navigateManager("orders")}>Xem đơn hàng</button>
          <button type="button" onClick={() => navigateManager("inventory")}>Kiểm tra tồn kho</button>
        </div>
      </aside>
    </div>
  );
};

const calculateTrendDelta = (trend = []) => {
  const totals = trend.reduce(
    (acc, row) => ({
      current: acc.current + Number(row?.current || 0),
      previous: acc.previous + Number(row?.previous || 0),
    }),
    { current: 0, previous: 0 }
  );

  if (!totals.previous) return null;
  return Number((((totals.current - totals.previous) / totals.previous) * 100).toFixed(1));
};

const ManagerAnalyst = () => {
  const {
    restaurantId,
    setRestaurantId,
    restaurants,
    restaurantOptions,
    range,
    setRange,
    loading,
    error,
    refetch,
    hasBusinessData,
    kpiData,
    revenueTrend,
    orderTrend,
    topDishes,
    feedbackSummary,
    feedbackItems,
    occupancyHeatmap,
    staffPerformance,
    demandForecast,
    staffSchedulingAssistant,
    menuEngineeringAssistant,
    smartPromotionEngine,
    statusCounts,
    recentOrders,
    lowStockItems,
    serviceRequests,
    operationsRequestsLoading,
    operationsRequestsError,
    refetchOperationsRequests,
  } = useAnalyst();

  const safeLowStockItems = Array.isArray(lowStockItems) ? lowStockItems : [];
  const icons = [DollarSign, Users, ShoppingBag, Star];
  const revenueProgress = calculateTrendProgress(revenueTrend);
  const orderProgress = calculateTrendProgress(orderTrend);
  const revenueTrendDelta = calculateTrendDelta(revenueTrend);
  const orderTrendDelta = calculateTrendDelta(orderTrend);
  const revenueValue = Number(kpiData[0]?.value || 0);
  const orderValue = Number(kpiData[2]?.value || 0);
  const hasRevenueThisPeriod = revenueValue > 0;
  const hasOrdersThisPeriod = orderValue > 0;

  const displayKpis = useMemo(
    () => [
      {
        ...kpiData[0],
        value: hasRevenueThisPeriod ? formatVnd(revenueValue) : "Chưa có",
        progress: hasRevenueThisPeriod ? revenueProgress : null,
        progressLabel: "So với kỳ trước",
        period:
          loading
            ? "Đang tải..."
            : !hasRevenueThisPeriod
              ? "Chưa có doanh thu trong kỳ này"
              : revenueProgress === null
                ? "Chưa có kỳ so sánh"
                : "So với kỳ trước theo doanh thu",
        trendValue: revenueTrendDelta,
        showTrend: hasRevenueThisPeriod && revenueTrendDelta !== null,
      },
      {
        ...kpiData[1],
        label: "Khách đã ghi nhận",
        value: Number(kpiData[1]?.value || 0),
        progress: null,
        period: loading
          ? "Đang tải..."
          : "Số khách từ hồ sơ khách hàng, không chỉ đơn trong kỳ",
        trendValue: null,
        showTrend: false,
      },
      {
        ...kpiData[2],
        value: hasOrdersThisPeriod ? orderValue : "Chưa có",
        progress: hasOrdersThisPeriod ? orderProgress : null,
        progressLabel: "So với kỳ trước",
        period:
          loading
            ? "Đang tải..."
            : !hasOrdersThisPeriod
              ? "Chưa có đơn trong kỳ này"
              : orderProgress === null
                ? "Chưa có kỳ so sánh"
                : "So với kỳ trước theo đơn hàng",
        trendValue: orderTrendDelta,
        showTrend: hasOrdersThisPeriod && orderTrendDelta !== null,
      },
      {
        ...kpiData[3],
        value:
          Number(feedbackSummary?.total || 0) === 0 &&
          Number(kpiData[3]?.value || 0) === 0
            ? "Chưa có"
            : `${Number(kpiData[3]?.value || 0).toFixed(1)}/5`,
        label:
          Number(feedbackSummary?.total || 0) === 0 &&
          Number(kpiData[3]?.value || 0) === 0
            ? "Chưa có đánh giá"
            : kpiData[3]?.label,
        progress:
          Number(feedbackSummary?.total || 0) === 0 &&
          Number(kpiData[3]?.value || 0) === 0
            ? null
            : clamp((Number(kpiData[3]?.value || 0) / 5) * 100),
        period:
          loading
            ? "Đang tải..."
            : Number(feedbackSummary?.total || 0) === 0 &&
                Number(kpiData[3]?.value || 0) === 0
              ? "Chưa có đánh giá"
              : "Điểm đánh giá trung bình",
        trendValue: null,
        showTrend: false,
      },
    ],
    [
      feedbackSummary,
      hasOrdersThisPeriod,
      hasRevenueThisPeriod,
      kpiData,
      loading,
      orderProgress,
      orderTrendDelta,
      orderValue,
      revenueProgress,
      revenueTrendDelta,
      revenueValue,
    ]
  );

  const availableRestaurants =
    restaurantOptions.length > 0 ? restaurantOptions : restaurants;
  const hasRestaurants = availableRestaurants.length > 0;
  const getRestaurantId = (restaurant) =>
    restaurant?.id || restaurant?._id || "";
  const getRestaurantLabel = (restaurant) =>
    restaurant?.name || restaurant?.restaurantName || "Nhà hàng chưa đặt tên";

  const actionItems = useMemo(() => {
    const processingOrders = Number(statusCounts?.pending || 0) + Number(statusCounts?.preparing || 0);
    const underStaffed = Number(staffSchedulingAssistant?.summary?.underStaffedShifts || 0);
    const peakSlot = demandForecast?.summary?.busiestPeriods?.[0] || demandForecast?.hourlyForecast?.[0] || demandForecast?.dailyForecast?.[0];
    const campaign = smartPromotionEngine?.campaigns?.[0] || smartPromotionEngine?.recommendations?.[0];
    const items = [];

    if (underStaffed > 0) {
      items.push({
        level: "critical",
        badge: "Khẩn cấp",
        source: "Nhân sự",
        icon: Users,
        title: `${underStaffed} ca thiếu người`,
        description: "Có ca cần bổ sung nhân sự trước giờ cao điểm để giảm rủi ro chậm phục vụ.",
        cta: "Kiểm tra phân ca",
        onClick: () => navigateManager("schedules"),
      });
    }

    if (processingOrders > 0) {
      items.push({
        level: processingOrders > 6 ? "critical" : "warning",
        badge: processingOrders > 6 ? "Khẩn cấp" : "Cần chú ý",
        source: "Đơn hàng",
        icon: ShoppingBag,
        title: `${processingOrders} đơn đang xử lý`,
        description: "Ưu tiên kiểm tra các đơn đang chờ xác nhận hoặc đang chuẩn bị để tránh nghẽn bếp.",
        cta: "Xem đơn hàng",
        onClick: () => navigateManager("orders"),
      });
    }

    if (safeLowStockItems.length > 0) {
      items.push({
        level: "warning",
        badge: "Cần chú ý",
        source: "Tồn kho",
        icon: AlertTriangle,
        title: `${safeLowStockItems.length} nguyên liệu tồn kho thấp`,
        description: "Kiểm tra nguyên liệu sắp hết trước khung giờ cao điểm.",
        cta: "Kiểm tra tồn kho",
        onClick: () => navigateManager("inventory"),
      });
    }

    if (peakSlot) {
      const label = typeof peakSlot === "string" ? peakSlot : peakSlot.label || peakSlot.timeRange || peakSlot.hourLabel || peakSlot.peakWindow || peakSlot.hour || "khung giờ cao điểm";
      items.push({
        level: "warning",
        badge: "Cần chú ý",
        source: "Dự báo nhu cầu",
        icon: Clock3,
        title: `Chuẩn bị cao điểm ${label}`,
        description: "Rà soát prep-list, bàn trống và tốc độ ra món cho khung giờ dự báo đông nhất.",
        cta: "Xem dự báo nhu cầu",
        onClick: () => document.getElementById("demand-forecast-section")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      });
    }

    if (campaign) {
      items.push({
        level: "info",
        badge: "Thông tin",
        source: "Khuyến mãi",
        icon: Megaphone,
        title: "Chiến dịch cần duyệt",
        description: "Có gợi ý khuyến mãi thông minh cần quản lý xác nhận trước khi triển khai.",
        cta: "Đi sang khuyến mãi",
        onClick: () => navigateManager("promotions"),
      });
    }

    if (!items.length) {
      items.push({
        level: "info",
        badge: "Thông tin",
        source: "Vận hành",
        icon: Sparkles,
        title: "Chưa có cảnh báo ưu tiên",
        description: "Dữ liệu hiện tại chưa ghi nhận đơn, nhân sự, tồn kho hoặc chiến dịch cần xử lý gấp.",
        cta: "Xem đơn hàng",
        onClick: () => navigateManager("orders"),
      });
    }

    return items.slice(0, 4);
  }, [demandForecast, safeLowStockItems, smartPromotionEngine, staffSchedulingAssistant, statusCounts]);

  if (error) {
    return (
      <div className="manager-analyst-page">
        <header className="analyst-header">
          <div className="header-titles">
            <span className="status-chip"><Sparkles size={13} /> Cập nhật theo kỳ đã chọn</span>
            <h1>Phân tích kinh doanh</h1>
            <p>Theo dõi doanh thu, nhu cầu, nhân sự, thực đơn và cảnh báo trong ca.</p>
          </div>
          <div className="header-actions">
            <button
              className="btn-icon"
              type="button"
              onClick={() => refetch()}
              aria-label="Làm mới dữ liệu"
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        <div className="analyst-error">
          Không tải được dữ liệu phân tích kinh doanh. Vui lòng thử làm mới.
          <button
            className="btn-icon analyst-error__retry"
            type="button"
            onClick={() => refetch()}
          >
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="manager-analyst-page">
      <header className="analyst-header">
        <div className="header-titles">
          <span className="status-chip"><Sparkles size={13} /> Cập nhật theo kỳ đã chọn</span>
          <h1>Phân tích kinh doanh</h1>
          <p>Theo dõi doanh thu, nhu cầu, nhân sự, thực đơn và cảnh báo trong ca.</p>
        </div>

        <div className="header-actions">
          {hasRestaurants ? (
            <div className="picker-wrap">
              <Store size={16} />
              <select
                value={restaurantId}
                onChange={(e) => setRestaurantId(e.target.value)}
                disabled={!restaurantId}
              >
                {availableRestaurants.map((restaurant, idx) => {
                  const optionId = getRestaurantId(restaurant);
                  const optionLabel = getRestaurantLabel(restaurant);

                  return (
                    <option key={optionId || `restaurant-${idx}`} value={optionId}>
                      {optionLabel}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : null}

          <div className="picker-wrap">
            <Calendar size={16} />
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
            </select>
          </div>

          <button
            className="btn-icon"
            type="button"
            onClick={() => refetch()}
            aria-label="Làm mới dữ liệu"
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={16} />
          </button>

          <button
            className="btn-primary"
            type="button"
            disabled
            aria-disabled="true"
          >
            <Download size={18} /> Sắp có
          </button>
        </div>
      </header>

      {!hasRestaurants ? (
        <div className="analyst-empty-page">
          Chưa có nhà hàng để phân tích. Hãy tạo nhà hàng hoặc kiểm tra quyền
          quản lý nhà hàng.
        </div>
      ) : !restaurantId ? (
        <div className="analyst-empty-page">Đang chuẩn bị dữ liệu nhà hàng...</div>
      ) : (
        <>
          {!loading && !hasBusinessData ? (
            <div className="analyst-empty-data">
              Cần có đơn hàng, menu, nhân sự hoặc review để tạo phân tích kinh
              doanh.
            </div>
          ) : null}

          <section className="analytics-section analytics-section--kpis">
            <div className="analytics-section__header">
              <span className="analytics-section__eyebrow">Chỉ số điều hành</span>
              <h3 className="analytics-section__title">Tổng quan điều hành</h3>
              <p className="analytics-section__subtitle">Các chỉ số chính theo nhà hàng và khoảng thời gian đã chọn.</p>
            </div>
            <div className="analytics-section__body kpi-section">
              {displayKpis.map((kpi, idx) => (
                <KPIInsightCard
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  trendValue={kpi.trendValue}
                  showTrend={kpi.showTrend}
                  period={kpi.period}
                  progress={kpi.progress}
                  progressLabel={kpi.progressLabel}
                  icon={icons[idx]}
                />
              ))}
            </div>
          </section>

          <section className="analytics-section analytics-section--action-center">
            <div className="analytics-section__header">
              <span className="analytics-section__eyebrow">Vận hành trong ngày</span>
              <h3 className="analytics-section__title">Vận hành hôm nay</h3>
              <p className="analytics-section__subtitle">Ưu tiên ca, hàng đợi khách, đơn gần đây và tồn kho thấp trong một cockpit gọn.</p>
            </div>
            <ActionCenter
              actions={actionItems}
              serviceRequests={serviceRequests}
              recentOrders={recentOrders}
              lowStockItems={safeLowStockItems}
              loading={operationsRequestsLoading}
              error={operationsRequestsError}
              onRefreshRequests={() => refetchOperationsRequests?.()}
            />
          </section>

          <section className="analytics-section analytics-section--revenue">
            <div className="analytics-section__header">
              <span className="analytics-section__eyebrow">Theo dõi doanh thu</span>
              <h3 className="analytics-section__title">Nhịp doanh thu</h3>
              <p className="analytics-section__subtitle">
                Đường xu hướng doanh thu theo khoảng thời gian đã chọn.
              </p>
            </div>
            <div className="analytics-section__body revenue-focus-grid">
              <div className="grid-item revenue-chart">
                <RevenueAnalyticsChart data={revenueTrend} orderData={orderTrend} rangeLabel={range === "week" ? "Tuần này" : "Tháng này"} loading={loading} />
              </div>
            </div>
          </section>

          <section className="analytics-section" id="demand-forecast-section">
            <div className="analytics-section__header">
              <span className="analytics-section__eyebrow">Dự báo và phân ca</span>
              <h3 className="analytics-section__title">Dự báo nhu cầu và phân ca</h3>
              <p className="analytics-section__subtitle">
                Dự báo nhu cầu và gợi ý phân ca theo khung giờ.
              </p>
            </div>
            <div className="analytics-section__body operations-intel-grid">
              <div className="grid-item demand-forecast">
                <DemandForecastWidget
                  forecast={demandForecast}
                  loading={loading}
                  onNavigate={navigateManager}
                />
              </div>
              <div className="grid-item scheduling-assistant">
                <StaffSchedulingAssistantWidget
                  assistant={staffSchedulingAssistant}
                  loading={loading}
                  onNavigate={navigateManager}
                />
              </div>
            </div>
          </section>

          <section className="analytics-section" id="smart-growth-section">
            <div className="analytics-section__header">
              <span className="analytics-section__eyebrow">Tăng trưởng và thực đơn</span>
              <h3 className="analytics-section__title">Tăng trưởng và menu</h3>
              <p className="analytics-section__subtitle">
                Gợi ý khuyến mãi và tối ưu menu để tăng doanh thu.
              </p>
            </div>
            <div className="analytics-section__body growth-grid">
              <div className="grid-item smart-promotion-engine">
                <SmartPromotionEngineWidget
                  engine={smartPromotionEngine}
                  loading={loading}
                  onNavigate={navigateManager}
                />
              </div>
              <div className="grid-item menu-engineering-assistant">
                <MenuEngineeringAssistantWidget
                  assistant={menuEngineeringAssistant}
                  loading={loading}
                  onNavigate={navigateManager}
                />
              </div>
            </div>
          </section>

          <section className="analytics-section">
            <div className="analytics-section__header">
              <span className="analytics-section__eyebrow">Chất lượng và hiệu suất</span>
              <h3 className="analytics-section__title">Chất lượng và hiệu suất</h3>
              <p className="analytics-section__subtitle">
                Theo dõi phản hồi, mật độ vận hành và hiệu suất nhân sự.
              </p>
            </div>
            <div className="analytics-section__body product-customer-grid">
              <div className="grid-item menu-matrix">
                <MenuEngineeringMatrix dishes={topDishes} />
              </div>
              <div className="grid-item feedback-analysis">
                <SmartFeedbackAnalysis
                  summary={feedbackSummary}
                  feedbacks={feedbackItems}
                  loading={loading}
                />
              </div>
            </div>
            <div className="analytics-section__body operations-grid">
              <div className="grid-item heatmap">
                <SmartOccupancyHeatmap
                  points={occupancyHeatmap}
                  loading={loading}
                />
              </div>
              <div className="grid-item staffing">
                <StaffPerformance
                  staffList={staffPerformance}
                  loading={loading}
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default ManagerAnalyst;
