import React from "react";
import { Wallet, Activity, Ticket, Flame } from "lucide-react";
import "./StatsCard.scss";

const StatsCard = ({ stats, labels }) => {
  // Cấu hình hiển thị cho từng loại chỉ số
  const statItems = [
    {
      key: "savings",
      label: labels.savings || "Tiết kiệm cho KH",
      value: `₫${(stats.totalSavings / 1000000).toFixed(1)}M`,
      icon: <Wallet size={24} />,
      colorClass: "green",
    },
    {
      key: "usage",
      label: labels.usage || "Tỷ lệ sử dụng",
      value: `${stats.usageRate}%`,
      icon: <Activity size={24} />,
      colorClass: "blue",
    },
    {
      key: "total",
      label: labels.total || "Tổng lượt dùng",
      value: stats.totalUsage.toLocaleString(),
      icon: <Ticket size={24} />,
      colorClass: "purple",
    },
    {
      key: "hot",
      label: labels.hot || "Đang thịnh hành",
      value: stats.hotPromotions,
      icon: <Flame size={24} />,
      colorClass: "orange",
    },
  ];

  return (
    <div className="stats-overview-grid">
      {statItems.map((item, index) => (
        <div key={index} className={`stat-card-premium ${item.colorClass}`}>
          <div className="stat-content">
            <span className="stat-label">{item.label}</span>
            <h3 className="stat-value">{item.value}</h3>
          </div>
          <div className="stat-icon-wrapper">{item.icon}</div>
        </div>
      ))}
    </div>
  );
};

export default StatsCard;
