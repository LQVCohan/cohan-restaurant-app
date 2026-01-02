import React from "react";
import {
  DollarSign,
  ShoppingBag,
  Users,
  Star,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import "./StatsGrid.scss";

const StatCard = ({
  icon: Icon,
  value,
  label,
  trend,
  trendValue,
  isNegative,
}) => {
  return (
    <div className="stat-card">
      <div className="card-content-wrapper">
        <div className="stat-info">
          <span className="stat-label">{label}</span>
          <h3 className="stat-value">{value}</h3>

          <div className={`stat-trend ${isNegative ? "negative" : "positive"}`}>
            {isNegative ? (
              <ArrowDownRight size={16} />
            ) : (
              <ArrowUpRight size={16} />
            )}
            <span className="trend-val">{trendValue}</span>
            <span className="trend-text">so với hôm qua</span>
          </div>
        </div>

        <div className="stat-icon-box">
          <Icon size={24} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
};

const StatsGrid = ({ stats, isLoading }) => {
  // Skeleton loading nếu cần
  if (isLoading) return <div className="stats-grid loading">Loading...</div>;

  return (
    <div className="stats-grid">
      <StatCard
        icon={DollarSign}
        value={stats.revenue || "0 ₫"}
        label="Doanh thu"
        trendValue="12.5%"
        isNegative={false}
      />
      <StatCard
        icon={ShoppingBag}
        value={stats.orders || "0"}
        label="Đơn hàng"
        trendValue="8.3%"
        isNegative={false}
      />
      <StatCard
        icon={Users}
        value={stats.customers || "0"}
        label="Khách hàng"
        trendValue="15.2%"
        isNegative={false}
      />
      <StatCard
        icon={Star}
        value={stats.rating || "0.0"}
        label="Đánh giá"
        trendValue="2.1%"
        isNegative={true}
      />
    </div>
  );
};

export default StatsGrid;
