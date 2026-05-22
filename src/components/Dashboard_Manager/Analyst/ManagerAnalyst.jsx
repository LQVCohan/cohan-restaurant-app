import React from "react";
import { Download, Calendar } from "lucide-react";
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

const ManagerAnalyst = () => {
  const {
    range,
    setRange,
    loading,
    error,
    kpiData,
    revenueTrend,
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

  return (
    <div className="manager-analyst-page">
      <header className="analyst-header">
        <div className="header-titles">
          <h1>Phân tích kinh doanh</h1>
          <p>Theo dõi doanh thu, nhu cầu, menu, nhân sự, khuyến mãi và hiệu suất vận hành.</p>
        </div>
        <div className="header-actions">
          <div className="date-picker-mock">
            <Calendar size={16} />
            <select value={range} onChange={(e) => setRange(e.target.value)}>
              <option value="week">Tuần này</option>
              <option value="month">Tháng này</option>
            </select>
          </div>
          <button className="btn-primary">
            <Download size={18} /> Xuất Báo Cáo
          </button>
        </div>
      </header>
      {error ? <div className="analyst-error">Không tải được dữ liệu Analyst.</div> : null}

      <section className="kpi-section">
        {kpiData.map((kpi, idx) => (
          <KPIInsightCard
            key={kpi.label}
            label={kpi.label}
            value={idx === 0 ? new Intl.NumberFormat("vi-VN").format(kpi.value) + "đ" : kpi.value}
            trendValue={0}
            period={loading ? "Đang tải..." : "Theo dữ liệu thật"}
            progress={Math.min(100, Math.max(0, Number(kpi.value || 0) % 100))}
            icon={icons[idx]}
          />
        ))}
      </section>

      <section className="strategy-grid">
        <div className="grid-item ai-assistant">
          <StrategyAIRecommendation topDish={topDishes[0]} feedbackSummary={feedbackSummary} />
        </div>
        <div className="grid-item revenue-chart">
          <RevenueAnalyticsChart data={revenueTrend} loading={loading} />
        </div>
      </section>



      <section className="forecast-grid">
        <div className="grid-item demand-forecast">
          <DemandForecastWidget forecast={demandForecast} loading={loading} />
        </div>
      </section>



      <section className="scheduling-assistant-grid">
        <div className="grid-item scheduling-assistant">
          <StaffSchedulingAssistantWidget assistant={staffSchedulingAssistant} loading={loading} />
        </div>
      </section>

      <section className="menu-engineering-assistant-grid">
        <div className="grid-item menu-engineering-assistant">
          <MenuEngineeringAssistantWidget assistant={menuEngineeringAssistant} loading={loading} />
        </div>
      </section>

      <section className="smart-promotion-engine-grid">
        <div className="grid-item smart-promotion-engine">
          <SmartPromotionEngineWidget engine={smartPromotionEngine} loading={loading} />
        </div>
      </section>

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
