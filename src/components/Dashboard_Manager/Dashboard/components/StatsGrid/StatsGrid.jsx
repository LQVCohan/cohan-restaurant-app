import React from "react";
import "./StatsGrid.scss";

const StatCard = ({ icon, value, label, trend, trendValue }) => (
  <div className="stat-card fade-in">
    <div className="stat-header">
      <div className="stat-icon">{icon}</div>
      <div className={`stat-trend ${trend}`}>
        {trend === "trend-up" ? "↗️" : "↘️"} {trendValue}
      </div>
    </div>
    <div className="stat-number">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const StatsGrid = ({ stats }) => {
  return (
    <div className="stats-grid">
      <StatCard
        icon="💰"
        value={stats.revenue}
        label="Doanh thu hôm nay"
        trend="trend-up"
        trendValue="+12.5%"
      />
      <StatCard
        icon="🛍️"
        value={stats.orders}
        label="Đơn hàng hôm nay"
        trend="trend-up"
        trendValue="+8.3%"
      />
      <StatCard
        icon="👥"
        value={stats.customers}
        label="Khách hàng mới"
        trend="trend-up"
        trendValue="+15.2%"
      />
      <StatCard
        icon="⭐"
        value={stats.rating}
        label="Đánh giá trung bình"
        trend="trend-down"
        trendValue="-2.1%"
      />
    </div>
  );
};

export default StatsGrid;
