import React from "react";
import {
  DollarSign,
  ShoppingBag,
  Users,
  Table2 as TableProperties,
  Utensils,
  Percent,
  CircleCheck,
  ChefHat,
  XCircle as CircleX,
  AlertTriangle,
} from "lucide-react";
import "./StatsGrid.scss";

const formatCurrency = (value) => {
  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return value;
  }

  const numericValue = Number(value || 0);
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
    notation: numericValue >= 100000000 ? "compact" : "standard",
  }).format(numericValue);
};

const CARD_CONFIG = {
  revenue: {
    label: "Doanh thu",
    icon: DollarSign,
    tone: "primary",
    help: "Trong thời gian đã chọn",
    format: formatCurrency,
  },
  orders: {
    label: "Tổng đơn hàng",
    icon: ShoppingBag,
    tone: "success",
    help: "Tổng số đơn trong thời gian đã chọn",
  },
  processing: {
    label: "Đơn đang xử lý",
    icon: ChefHat,
    tone: "warning",
    help: "Đơn chờ xác nhận hoặc đang được chuẩn bị",
  },
  alerts: {
    label: "Cảnh báo tồn kho",
    icon: AlertTriangle,
    tone: "neutral",
    help: "Mặt hàng sắp hết cần kiểm tra",
  },
  customers: {
    label: "Khách có đơn",
    icon: Users,
    tone: "neutral",
  },
  tables: {
    label: "Tổng số bàn",
    icon: TableProperties,
    tone: "neutral",
  },
  menuItems: {
    label: "Món trong thực đơn",
    icon: Utensils,
    tone: "neutral",
  },
  promotions: {
    label: "Khuyến mãi đang áp dụng",
    icon: Percent,
    tone: "warning",
  },
  staff: {
    label: "Nhân viên đang công tác",
    icon: Users,
    tone: "neutral",
  },
  completed: {
    label: "Đơn đã hoàn thành",
    icon: CircleCheck,
    tone: "success",
  },
  cancelled: {
    label: "Đơn đã hủy",
    icon: CircleX,
    tone: "danger",
  },
};

const ORDER_BY_VARIANT = {
  summary: ["revenue", "orders", "processing", "alerts"],
  compact: [
    "customers",
    "tables",
    "menuItems",
    "promotions",
    "staff",
    "completed",
    "cancelled",
  ],
};

const StatSkeleton = ({ variant }) => (
  <article
    className={`stat-card stat-card--skeleton stat-card--${variant}`}
    aria-hidden="true"
  >
    <span className="icon-badge" />
    <span className="stat-skeleton stat-skeleton--label" />
    <span className="stat-skeleton stat-skeleton--value" />
    {variant === "summary" ? (
      <span className="stat-skeleton stat-skeleton--help" />
    ) : null}
  </article>
);

const StatCard = ({ label, value, icon: Icon, tone, variant, help }) => (
  <article className={`stat-card stat-card--${tone} stat-card--${variant}`}>
    <span className="icon-badge" aria-hidden="true">
      {Icon ? <Icon size={variant === "summary" ? 18 : 16} /> : null}
    </span>
    <p className="stat-label">{label}</p>
    <p className="stat-value">{value}</p>
    {help ? <p className="stat-help">{help}</p> : null}
  </article>
);

const StatsGrid = ({
  stats,
  isLoading,
  variant = "compact",
  alertsCount = 0,
}) => {
  const statusCounts = stats?.statusCounts || {};
  const keys = ORDER_BY_VARIANT[variant] || ORDER_BY_VARIANT.compact;

  const getValue = (key) => {
    if (key === "processing") {
      return (statusCounts.pending || 0) + (statusCounts.preparing || 0);
    }
    if (key === "alerts") return alertsCount;
    if (["completed", "cancelled"].includes(key)) {
      return statusCounts[key] ?? 0;
    }
    return stats?.[key] ?? 0;
  };

  const getCardConfig = (key) => {
    const baseConfig = CARD_CONFIG[key];
    if (key !== "alerts") return baseConfig;

    const count = Number(alertsCount || 0);
    return {
      ...baseConfig,
      icon: count > 0 ? AlertTriangle : CircleCheck,
      tone: count > 0 ? "danger" : "success",
      help:
        count > 0
          ? `Có ${count} mặt hàng cần kiểm tra`
          : "Không có cảnh báo tồn kho",
    };
  };

  return (
    <section
      className={`stats-grid-container stats-grid-container--${variant}`}
      aria-label={
        variant === "summary"
          ? "Các chỉ số vận hành chính"
          : "Các số liệu vận hành cơ bản"
      }
    >
      {keys.map((key) => {
        if (isLoading) return <StatSkeleton key={key} variant={variant} />;

        const config = getCardConfig(key);
        const rawValue = getValue(key);
        const formattedValue = config.format
          ? config.format(rawValue)
          : rawValue;

        return (
          <StatCard
            key={key}
            label={config.label}
            value={formattedValue}
            icon={config.icon}
            tone={config.tone}
            variant={variant}
            help={variant === "summary" ? config.help : ""}
          />
        );
      })}
    </section>
  );
};

export default StatsGrid;
