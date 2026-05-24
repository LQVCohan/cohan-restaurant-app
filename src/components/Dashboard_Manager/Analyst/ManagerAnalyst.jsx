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

const ManagerAnalyst = () => {
  const {
    restaurantId,
    setRestaurantId,
    restaurants,
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

  const displayKpis = useMemo(
    () => [
      {
        ...kpiData[0],
        value: formatVnd(kpiData[0]?.value),
        progress: revenueProgress,
        period: loading ? "Đang tải..." : "So với kỳ trước theo doanh thu",
      },
      {
        ...kpiData[1],
        value: Number(kpiData[1]?.value || 0),
        progress: null,
        period: loading ? "Đang tải..." : "Theo dữ liệu khách hàng",
      },
      {
        ...kpiData[2],
        value: Number(kpiData[2]?.value || 0),
        progress: orderProgress,
        period: loading ? "Đang tải..." : "So với kỳ trước theo đơn hàng",
      },
      {
        ...kpiData[3],
        value: `${Number(kpiData[3]?.value || 0).toFixed(1)}/5`,
        progress: clamp((Number(kpiData[3]?.value || 0) / 5) * 100),
        period: loading ? "Đang tải..." : "Điểm đánh giá trung bình",
      },
    ],
    [kpiData, loading, revenueProgress, orderProgress]
  );

  if (!restaurantId) {
    return <div className="analyst-empty-page">Vui lòng chọn hoặc tạo nhà hàng trước khi xem phân tích kinh doanh.</div>;
  }

  if (error) {
    return (
      <div className="manager-analyst-page">
        <header className="analyst-header">
          <div className="header-titles">
            <h1>Phân tích kinh doanh</h1>
            <p>Theo dõi doanh thu, nhu cầu, menu, nhân sự, khuyến mãi và hiệu suất vận hành.</p>
          </div>
        </header>
        <div className="analyst-error">Không tải được dữ liệu phân tích kinh doanh. Vui lòng thử làm mới.</div>
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
          {restaurants.length > 1 ? (
            <div className="picker-wrap">
              <Store size={16} />
              <select value={restaurantId} onChange={(e) => setRestaurantId(e.target.value)}>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
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

      {!loading && !hasBusinessData ? (
        <div className="analyst-empty-data">Cần có đơn hàng, menu, nhân sự hoặc review để tạo phân tích kinh doanh.</div>
      ) : null}

      <section className="kpi-section">
        {displayKpis.map((kpi, idx) => (
          <KPIInsightCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            trendValue={0}
            period={kpi.period}
            progress={kpi.progress}
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
    </div>
  );
};

export default ManagerAnalyst;
