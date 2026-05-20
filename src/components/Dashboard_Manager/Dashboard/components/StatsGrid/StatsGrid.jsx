import React from "react";
import {
  DollarSign,
  ShoppingBag,
  Users,
  TableProperties,
  Utensils,
  Percent,
  CircleCheck,
  ChefHat,
  CircleX,
  AlertTriangle,
} from "lucide-react";
import "./StatsGrid.scss";

const CARD_CONFIG = {
  revenue: { label: "Doanh thu", icon: DollarSign, tone: "primary" },
  orders: { label: "Tổng đơn", icon: ShoppingBag, tone: "success" },
  processing: { label: "Đơn cần xử lý", icon: ChefHat, tone: "warning" },
  alerts: { label: "Cảnh báo vận hành", icon: AlertTriangle, tone: "danger" },
  customers: { label: "Khách hàng", icon: Users, tone: "neutral" },
  tables: { label: "Số bàn", icon: TableProperties, tone: "neutral" },
  menuItems: { label: "Số món", icon: Utensils, tone: "neutral" },
  promotions: { label: "Khuyến mãi hoạt động", icon: Percent, tone: "warning" },
  staff: { label: "Nhân sự", icon: Users, tone: "neutral" },
  completed: { label: "Đơn hoàn thành", icon: CircleCheck, tone: "success" },
  cancelled: { label: "Đơn hủy", icon: CircleX, tone: "danger" },
};

const ORDER_BY_VARIANT = {
  summary: ["revenue", "orders", "processing", "alerts"],
  compact: ["customers", "tables", "menuItems", "promotions", "staff", "completed", "cancelled"],
};

const StatCard = ({ label, value, icon: Icon, tone, variant }) => (
  <div className={`stat-card stat-card--${tone} stat-card--${variant}`}>
    <span className="icon-badge">{Icon ? <Icon size={variant === "summary" ? 20 : 18} /> : null}</span>
    <p className="stat-label">{label}</p>
    <h3 className="stat-value">{value}</h3>
  </div>
);

const StatsGrid = ({ stats, isLoading, variant = "compact", alertsCount = 0 }) => {
  const statusCounts = stats?.statusCounts || {};
  const keys = ORDER_BY_VARIANT[variant] || ORDER_BY_VARIANT.compact;

  const getValue = (key) => {
    if (key === "processing") return (statusCounts.pending || 0) + (statusCounts.preparing || 0);
    if (key === "alerts") return alertsCount;
    if (["completed", "cancelled"].includes(key)) return statusCounts[key] ?? 0;
    return stats?.[key] ?? 0;
  };

  return (
    <div className={`stats-grid-container stats-grid-container--${variant}`}>
      {keys.map((key) => {
        const config = CARD_CONFIG[key];
        return (
          <StatCard
            key={key}
            label={config.label}
            value={isLoading ? "..." : getValue(key)}
            icon={config.icon}
            tone={config.tone}
            variant={variant}
          />
        );
      })}
    </div>
  );
};

export default StatsGrid;
