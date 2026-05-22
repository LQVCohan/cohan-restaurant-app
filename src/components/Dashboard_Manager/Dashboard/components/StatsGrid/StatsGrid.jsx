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
  revenue: { label: "Doanh thu", icon: DollarSign, tone: "primary", help: "Trong khoảng thời gian đã chọn" },
  orders: { label: "Tổng đơn", icon: ShoppingBag, tone: "success", help: "Trong khoảng thời gian đã chọn" },
  processing: { label: "Đơn cần xử lý", icon: ChefHat, tone: "warning", help: "Cần xử lý" },
  alerts: { label: "Cảnh báo vận hành", icon: AlertTriangle, tone: "neutral", help: "Ổn định" },
  customers: { label: "Khách hàng", icon: Users, tone: "neutral" }, tables: { label: "Số bàn", icon: TableProperties, tone: "neutral" }, menuItems: { label: "Số món", icon: Utensils, tone: "neutral" }, promotions: { label: "Khuyến mãi hoạt động", icon: Percent, tone: "warning" }, staff: { label: "Nhân sự", icon: Users, tone: "neutral" }, completed: { label: "Đơn hoàn thành", icon: CircleCheck, tone: "success" }, cancelled: { label: "Đơn hủy", icon: CircleX, tone: "danger" },
};
const ORDER_BY_VARIANT = { summary: ["revenue", "orders", "processing", "alerts"], compact: ["customers", "tables", "menuItems", "promotions", "staff", "completed", "cancelled"] };
const StatCard = ({ label, value, icon: Icon, tone, variant, help }) => <div className={`stat-card stat-card--${tone} stat-card--${variant}`}><span className="icon-badge">{Icon ? <Icon size={variant === "summary" ? 18 : 16} /> : null}</span><p className="stat-label">{label}</p><h3 className="stat-value">{value}</h3>{help ? <p className="stat-help">{help}</p> : null}</div>;
const StatsGrid = ({ stats, isLoading, variant = "compact", alertsCount = 0 }) => {
  const statusCounts = stats?.statusCounts || {};
  const keys = ORDER_BY_VARIANT[variant] || ORDER_BY_VARIANT.compact;
  const getValue = (key) => {
    if (key === "processing") return (statusCounts.pending || 0) + (statusCounts.preparing || 0);
    if (key === "alerts") return alertsCount;
    if (["completed", "cancelled"].includes(key)) return statusCounts[key] ?? 0;
    return stats?.[key] ?? 0;
  };
  const getCardConfig = (key) => {
    const baseConfig = CARD_CONFIG[key];

    if (key === "alerts") {
      const count = Number(alertsCount || 0);

      return {
        ...baseConfig,
        icon: count > 0 ? AlertTriangle : CircleCheck,
        tone: count > 0 ? "danger" : "success",
        help: count > 0 ? "Cần theo dõi" : "Ổn định",
      };
    }

    return baseConfig;
  };

  return <div className={`stats-grid-container stats-grid-container--${variant}`}>{keys.map((key) => { const config = getCardConfig(key); return <StatCard key={key} label={config.label} value={isLoading ? "..." : getValue(key)} icon={config.icon} tone={config.tone} variant={variant} help={variant === "summary" ? config.help : ""} />; })}</div>;
};

export default StatsGrid;
