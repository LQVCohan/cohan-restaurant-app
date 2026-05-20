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

const PRIMARY_KEYS = ["revenue", "orders", "customers", "tables"];

const CARD_CONFIG = {
  revenue: { label: "Doanh thu", icon: DollarSign, tone: "primary" },
  orders: { label: "Tổng đơn", icon: ShoppingBag, tone: "success" },
  customers: { label: "Khách hàng", icon: Users, tone: "info" },
  tables: { label: "Số bàn", icon: TableProperties, tone: "neutral" },
  menuItems: { label: "Số món", icon: Utensils, tone: "neutral" },
  promotions: { label: "Khuyến mãi hoạt động", icon: Percent, tone: "warning" },
  staff: { label: "Nhân sự", icon: Users, tone: "neutral" },
  pending: { label: "Đơn chờ", icon: Clock3, tone: "warning" },
  preparing: { label: "Đơn xử lý", icon: ChefHat, tone: "primary" },
  completed: { label: "Đơn hoàn thành", icon: CircleCheck, tone: "success" },
  cancelled: { label: "Đơn hủy", icon: CircleX, tone: "danger" },
};

const CARD_ORDER = [
  "revenue",
  "orders",
  "customers",
  "tables",
  "menuItems",
  "promotions",
  "staff",
  "pending",
  "preparing",
  "completed",
  "cancelled",
];

const SkeletonCard = () => (
  <div className="stat-card stat-card--skeleton" aria-hidden="true">
    <div className="stat-card__top">
      <div className="dashboard-skeleton sk-icon" />
    </div>
    <div className="dashboard-skeleton sk-label" />
    <div className="dashboard-skeleton sk-value" />
    <div className="dashboard-skeleton sk-sub" />
  </div>
);

const StatCard = ({ label, value, icon: Icon, tone, isPrimary = false }) => (
  <div className={`stat-card stat-card--${tone} ${isPrimary ? "stat-card--primary-kpi" : "stat-card--secondary-kpi"}`}>
    <div className="stat-card__top">
      <span className="icon-badge">{Icon ? <Icon size={20} /> : null}</span>
    </div>
    <p className="stat-label">{label}</p>
    <h3 className="stat-value">{value}</h3>
    <p className="stat-sub">Theo khoảng thời gian đã chọn</p>
  </div>
);

const StatsGrid = ({ stats, isLoading }) => {
  const statusCounts = stats?.statusCounts || {};

  return (
    <div className="stats-grid-container">
      {isLoading
        ? CARD_ORDER.map((key) => <SkeletonCard key={key} />)
        : CARD_ORDER.map((key) => {
            const config = CARD_CONFIG[key];
            const value = ["pending", "preparing", "completed", "cancelled"].includes(key)
              ? statusCounts[key] ?? 0
              : stats?.[key] ?? 0;

            return (
              <StatCard
                key={key}
                label={config.label}
                value={value}
                icon={config.icon}
                tone={config.tone}
                isPrimary={PRIMARY_KEYS.includes(key)}
              />
            );
          })}
    </div>
  );
};

export default StatsGrid;
