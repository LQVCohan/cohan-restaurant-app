import React from "react";
import { Download, Calendar, Filter } from "lucide-react";

// --- Import các Component Thông Minh ---
import KPIInsightCard from "./components/KPIInsightCard"; // Component cơ bản
import RevenueAnalyticsChart from "./components/RevenueAnalyticsChart"; // Biểu đồ tài chính
import StrategyAIRecommendation from "./components/StrategyAIRecommendation"; // Trợ lý AI
import MenuEngineeringMatrix from "./components/MenuEngineeringMatrix"; // Ma trận BCG
import SmartFeedbackAnalysis from "./components/SmartFeedbackAnalysis"; // Phân tích phản hồi
import SmartOccupancyHeatmap from "./components/SmartOccupancyHeatmap"; // Dự báo nhiệt
import StaffPerformance from "./components/StaffPerformance"; // Tối ưu nhân sự

// --- Dữ liệu Mock cho KPI (Các component khác đã có data nội tại) ---
import { DollarSign, Users, ShoppingBag, Star } from "lucide-react";
import "./ManagerAnalyst.scss";

const ManagerAnalyst = () => {
  const kpiData = [
    {
      label: "Doanh Thu Thuần",
      value: "2.4 Tỷ",
      trendValue: 12.5,
      period: "Tháng này",
      progress: 85,
      icon: DollarSign,
      color: "#c5a47e",
    },
    {
      label: "Lượng Khách",
      value: "3,450",
      trendValue: -2.1,
      period: "Tháng này",
      progress: 60,
      icon: Users,
      color: "#3b82f6",
    },
    {
      label: "Tổng Đơn",
      value: "1,208",
      trendValue: 8.4,
      period: "Tháng này",
      progress: 92,
      icon: ShoppingBag,
      color: "#10b981",
    },
    {
      label: "Điểm Tin Cậy",
      value: "4.8/5",
      trendValue: 0.5,
      period: "Ổn định",
      progress: 96,
      icon: Star,
      color: "#f59e0b",
    },
  ];

  return (
    <div className="manager-analyst-page">
      {/* 1. HEADER: Bộ lọc & Hành động */}
      <header className="analyst-header">
        <div className="header-titles">
          <h1>Business Intelligence Hub</h1>
          <p>Phân tích dữ liệu vận hành & Chiến lược kinh doanh</p>
        </div>
        <div className="header-actions">
          <div className="date-picker-mock">
            <Calendar size={16} />
            <span>29/12/2025 - 04/01/2026</span>
          </div>
          <button className="btn-icon">
            <Filter size={18} />
          </button>
          <button className="btn-primary">
            <Download size={18} /> Xuất Báo Cáo
          </button>
        </div>
      </header>

      {/* 2. KPI OVERVIEW: Chỉ số nhanh */}
      <section className="kpi-section">
        {kpiData.map((kpi, idx) => (
          <KPIInsightCard key={idx} {...kpi} />
        ))}
      </section>

      {/* 3. STRATEGY LAYER: AI & Tài chính (Quan trọng nhất) */}
      <section className="strategy-grid">
        {/* Cột Trái: Trợ lý AI (Chiếm 30%) */}
        <div className="grid-item ai-assistant">
          <StrategyAIRecommendation />
        </div>
        {/* Cột Phải: Biểu đồ doanh thu (Chiếm 70%) */}
        <div className="grid-item revenue-chart">
          <RevenueAnalyticsChart />
        </div>
      </section>

      {/* 4. PRODUCT & CX LAYER: Thực đơn & Khách hàng */}
      <section className="product-customer-grid">
        {/* Ma trận Menu (BCG) - Rộng để dễ nhìn */}
        <div className="grid-item menu-matrix">
          <MenuEngineeringMatrix />
        </div>
        {/* Phân tích Feedback - Hẹp hơn */}
        <div className="grid-item feedback-analysis">
          <SmartFeedbackAnalysis />
        </div>
      </section>

      {/* 5. OPERATIONS LAYER: Vận hành & Nhân sự */}
      <section className="operations-grid">
        {/* Heatmap Dự báo khách */}
        <div className="grid-item heatmap">
          <SmartOccupancyHeatmap />
        </div>
        {/* Biểu đồ Hiệu quả Nhân sự */}
        <div className="grid-item staffing">
          <StaffPerformance />
        </div>
      </section>

      <footer className="analyst-footer">
        <p>
          © 2025 RestaurantOS Intelligence System. Dữ liệu được cập nhật
          Real-time.
        </p>
      </footer>
    </div>
  );
};

export default ManagerAnalyst;
