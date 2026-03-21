import React from "react";
import {
  DollarSign,
  ShoppingBag,
  Users,
  TableProperties,
  Utensils,
  Percent,
  Clock3,
  CircleCheck,
  ChefHat,
  CircleX,
} from "lucide-react";
import "./StatsGrid.scss";

const CARDS = [
  { key: "revenue", label: "Doanh thu", icon: DollarSign },
  { key: "orders", label: "Tổng đơn", icon: ShoppingBag },
  { key: "customers", label: "Khách hàng", icon: Users },
  { key: "tables", label: "Số bàn", icon: TableProperties },
  { key: "menuItems", label: "Số món", icon: Utensils },
  { key: "promotions", label: "KM hoạt động", icon: Percent },
  { key: "staff", label: "Nhân sự", icon: Users },
];

const STATUS_CARDS = [
  { key: "pending", label: "Đơn chờ", icon: Clock3 },
  { key: "preparing", label: "Đơn xử lý", icon: ChefHat },
  { key: "completed", label: "Đơn hoàn thành", icon: CircleCheck },
  { key: "cancelled", label: "Đơn hủy", icon: CircleX },
];

const StatCard = ({ label, value, icon, isLoading }) => (
  <div className="stat-card">
    <div className="card-header">
      <span className="stat-label">{label}</span>
      {icon ? React.createElement(icon, { size: 18 }) : null}
    </div>
    <h3 className="stat-value">{isLoading ? "..." : value}</h3>
  </div>
);

const StatsGrid = ({ stats, isLoading }) => {
  const statusCounts = stats?.statusCounts || {};
  return (
    <div className="stats-grid-container">
      {CARDS.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          icon={item.icon}
          value={stats?.[item.key] ?? 0}
          isLoading={isLoading}
        />
      ))}
      {STATUS_CARDS.map((item) => (
        <StatCard
          key={item.key}
          label={item.label}
          icon={item.icon}
          value={statusCounts[item.key] ?? 0}
          isLoading={isLoading}
        />
      ))}
    </div>
  );
};

export default StatsGrid;
