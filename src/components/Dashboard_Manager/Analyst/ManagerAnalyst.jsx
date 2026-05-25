import React, { useMemo } from "react";
import { Download, Calendar, RefreshCw, Store } from "lucide-react";
import { DollarSign, Users, ShoppingBag, Star } from "lucide-react";
import { useAnalyst } from "../../../hooks/useAnalyst";
import KPIInsightCard from "./components/KPIInsightCard";
import RevenueAnalyticsChart from "./components/RevenueAnalyticsChart";
import StrategyAIRecommendation from "./components/StrategyAIRecommendation";
import MenuEngineeringMatrix from "./components/MenuEngineeringMatrix";
import SmartFeedbackAnalysis from "./components/SmartFeedbackAnalysis";
import SmartOccupancyHeatmap from "./components/SmartOccupancyHeatmap";
import StaffPerformance from "./components/StaffPerformance";
import DemandForecastWidget from "./components/DemandForecastWidget";
import StaffSchedulingAssistantWidget from "./components/StaffSchedulingAssistantWidget";
import MenuEngineeringAssistantWidget from "./components/MenuEngineeringAssistantWidget";
import SmartPromotionEngineWidget from "./components/SmartPromotionEngineWidget";
import "./ManagerAnalyst.scss";

const formatVnd = (value) => `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;
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
  } = useAnalyst();

  const icons = [DollarSign, Users, ShoppingBag, Star];
  const revenueProgress = calculateTrendProgress(revenueTrend);
  const orderProgress = calculateTrendProgress(orderTrend);
  const revenueTrendDelta = calculateTrendDelta(revenueTrend);
  const orderTrendDelta = calculateTrendDelta(orderTrend);

  const displayKpis = useMemo(
    () => [
      {
        ...kpiData[0],
        value: formatVnd(kpiData[0]?.value),
        progress: revenueProgress,
        progressLabel: "So với kỳ trước",
        period: loading ? "Đang tải..." : revenueProgress === null ? "Chưa có kỳ so sánh" : "So với kỳ trước theo doanh thu",
        trendValue: revenueTrendDelta,
        showTrend: revenueTrendDelta !== null,
      },
      {
        ...kpiData[1],
        label: "Khách đã ghi nhận",
        value: Number(kpiData[1]?.value || 0),
        progress: null,
        period: loading ? "Đang tải..." : "Số khách từ hồ sơ khách hàng, không chỉ đơn trong kỳ",
        trendValue: null,
        showTrend: false,
      },
      {
        ...kpiData[2],
        value: Number(kpiData[2]?.value || 0),
        progress: orderProgress,
        progressLabel: "So với kỳ trước",
        period: loading ? "Đang tải..." : orderProgress === null ? "Chưa có kỳ so sánh" : "So với kỳ trước theo đơn hàng",
        trendValue: orderTrendDelta,
        showTrend: orderTrendDelta !== null,
      },
      {
        ...kpiData[3],
        value: `${Number(kpiData[3]?.value || 0).toFixed(1)}/5`,
        progress: clamp((Number(kpiData[3]?.value || 0) / 5) * 100),
        period: loading ? "Đang tải..." : "Điểm đánh giá trung bình",
        trendValue: null,
        showTrend: false,
      },
    ],
    [kpiData, loading, revenueProgress, orderProgress, revenueTrendDelta, orderTrendDelta]
  );



  const availableRestaurants = restaurantOptions.length > 0 ? restaurantOptions : restaurants;
  const hasRestaurants = availableRestaurants.length > 0;
  const getRestaurantId = (restaurant) => restaurant?.id || restaurant?._id || "";
  const getRestaurantLabel = (restaurant) => restaurant?.name || restaurant?.restaurantName || "Nhà hàng chưa đặt tên";

  if (error) {
    return (
      <div className="manager-analyst-page">
        <header className="analyst-header">
          <div className="header-titles">
            <h1>Phân tích kinh doanh</h1>
            <p>Theo dõi doanh thu, nhu cầu, menu, nhân sự, khuyến mãi và hiệu suất vận hành.</p>
          </div>
          <div className="header-actions">
            <button className="btn-icon" type="button" onClick={() => refetch()}>
              <RefreshCw size={16} />
            </button>
          </div>
        </header>
        <div className="analyst-error">
          Không tải được dữ liệu phân tích kinh doanh. Vui lòng thử làm mới.
          <button className="btn-icon" type="button" onClick={() => refetch()} style={{ marginLeft: 10 }}>
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
          <h1>Phân tích kinh doanh</h1>
          <p>Theo dõi doanh thu, nhu cầu, menu, nhân sự, khuyến mãi và hiệu suất vận hành.</p>
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
          <button className="btn-icon" type="button" onClick={() => refetch()}>
            <RefreshCw size={16} />
          </button>
          <button className="btn-primary" type="button" disabled>
            <Download size={18} /> Xuất báo cáo sắp có
          </button>
        </div>
      </header>

      {!hasRestaurants ? (
        <div className="analyst-empty-page">Chưa có nhà hàng để phân tích. Hãy tạo nhà hàng hoặc kiểm tra quyền quản lý nhà hàng.</div>
      ) : !restaurantId ? (
        <div className="analyst-empty-page">Đang chuẩn bị dữ liệu nhà hàng...</div>
      ) : (
        <>
          {!loading && !hasBusinessData ? (
            <div className="analyst-empty-data">Cần có đơn hàng, menu, nhân sự hoặc review để tạo phân tích kinh doanh.</div>
          ) : null}

          <section className="kpi-section">
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
          </section>

          <section className="strategy-grid">
            <div className="grid-item ai-assistant">
              <StrategyAIRecommendation
                topDish={topDishes[0]}
                feedbackSummary={feedbackSummary}
                demandForecast={demandForecast}
                staffSchedulingAssistant={staffSchedulingAssistant}
                menuEngineeringAssistant={menuEngineeringAssistant}
                smartPromotionEngine={smartPromotionEngine}
              />
            </div>
            <div className="grid-item revenue-chart">
              <RevenueAnalyticsChart data={revenueTrend} loading={loading} />
            </div>
          </section>

          <h3 className="section-heading">Ưu tiên vận hành</h3>
          <section className="operations-intel-grid">
            <div className="grid-item demand-forecast">
              <DemandForecastWidget forecast={demandForecast} loading={loading} />
            </div>
            <div className="grid-item scheduling-assistant">
              <StaffSchedulingAssistantWidget assistant={staffSchedulingAssistant} loading={loading} />
            </div>
          </section>

          <h3 className="section-heading">Tăng trưởng doanh thu</h3>
          <section className="growth-grid">
            <div className="grid-item smart-promotion-engine">
              <SmartPromotionEngineWidget engine={smartPromotionEngine} loading={loading} />
            </div>
            <div className="grid-item menu-engineering-assistant">
              <MenuEngineeringAssistantWidget assistant={menuEngineeringAssistant} loading={loading} />
            </div>
          </section>

          <h3 className="section-heading">Chất lượng & hiệu suất</h3>
          <section className="product-customer-grid">
            <div className="grid-item menu-matrix">
              <MenuEngineeringMatrix dishes={topDishes} />
            </div>
            <div className="grid-item feedback-analysis">
              <SmartFeedbackAnalysis summary={feedbackSummary} feedbacks={feedbackItems} loading={loading} />
            </div>
          </section>

          <section className="operations-grid">
            <div className="grid-item heatmap">
              <SmartOccupancyHeatmap points={occupancyHeatmap} loading={loading} />
            </div>
            <div className="grid-item staffing">
              <StaffPerformance staffList={staffPerformance} loading={loading} />
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default ManagerAnalyst;
