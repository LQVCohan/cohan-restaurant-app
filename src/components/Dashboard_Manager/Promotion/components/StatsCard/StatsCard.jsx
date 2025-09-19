import React from "react";
import "./StatsCard.scss";

const StatsCard = ({ stats }) => {
  const statsData = [
    {
      number: `₫${(stats.totalSavings / 1000000).toFixed(1)}M`,
      label: "Tiết kiệm KH",
    },
    {
      number: `${stats.usageRate}%`,
      label: "Tỷ lệ dùng",
    },
    {
      number: stats.totalUsage,
      label: "Lượt sử dụng",
    },
    {
      number: stats.hotPromotions,
      label: "KM hot",
    },
  ];

  return (
    <div className="stats-card">
      <div className="stats-grid">
        {statsData.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-card-number">{stat.number}</div>
            <div className="stat-card-label">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsCard;
