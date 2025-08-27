import React from "react";
import {
  Utensils,
  CheckCircle,
  AlertCircle,
  XCircle,
  Package,
} from "lucide-react";
import "./StatsGrid.scss";

const StatsGrid = ({ stats, onFilterByStatus }) => {
  const statsData = [
    {
      key: "total",
      label: "Tổng số món",
      value: stats.total,
      icon: Utensils,
      color: "blue",
      onClick: () => onFilterByStatus(""),
    },
    {
      key: "available",
      label: "Món có sẵn",
      value: stats.available,
      icon: CheckCircle,
      color: "green",
      onClick: () => onFilterByStatus("available"),
    },
    {
      key: "limited",
      label: "Món có hạn",
      value: stats.limited,
      icon: AlertCircle,
      color: "orange",
      onClick: () => onFilterByStatus("limited"),
    },
    {
      key: "unavailable",
      label: "Hết món",
      value: stats.unavailable,
      icon: XCircle,
      color: "purple",
      onClick: () => onFilterByStatus("unavailable"),
    },
    {
      key: "stock",
      label: "Món tồn kho",
      value: stats.stock,
      icon: Package,
      color: "yellow",
      onClick: () => onFilterByStatus("stock"),
    },
  ];

  return (
    <div className="stats-grid">
      {statsData.map((stat) => {
        const IconComponent = stat.icon;
        return (
          <div
            key={stat.key}
            className="stats-grid__card"
            onClick={stat.onClick}
          >
            <div className="stats-grid__header">
              <div
                className={`stats-grid__icon stats-grid__icon--${stat.color}`}
              >
                <IconComponent size={20} />
              </div>
              <div className="stats-grid__value">{stat.value}</div>
            </div>
            <div className="stats-grid__label">{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
};

export default StatsGrid;
