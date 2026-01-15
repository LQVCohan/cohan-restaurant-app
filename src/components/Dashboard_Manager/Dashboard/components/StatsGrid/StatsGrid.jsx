import React from "react";
import {
  DollarSign,
  ShoppingBag,
  Users,
  Star,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import "./StatsGrid.scss";

// 1. Dữ liệu giả lập cho Sparkline (Biểu đồ mini)
const SPARK_DATA = [
  { val: 10 },
  { val: 25 },
  { val: 15 },
  { val: 35 },
  { val: 20 },
  { val: 45 },
  { val: 60 },
];
const SPARK_DATA_DOWN = [
  { val: 60 },
  { val: 55 },
  { val: 40 },
  { val: 25 },
  { val: 30 },
  { val: 15 },
  { val: 10 },
];

// 2. Cấu hình màu sắc & Icon cho từng loại chỉ số
const CARD_VARIANTS = {
  revenue: { color: "emerald", icon: DollarSign, label: "Doanh Thu" },
  orders: { color: "blue", icon: ShoppingBag, label: "Đơn Hàng" },
  customers: { color: "violet", icon: Users, label: "Khách Hàng" },
  rating: { color: "amber", icon: Star, label: "Đánh Giá" },
};

// COMPONENT: Card Đơn lẻ
const StatCard = ({ type, value, trend, trendValue, chartData, isLoading }) => {
  const config = CARD_VARIANTS[type] || CARD_VARIANTS.revenue;
  const Icon = config.icon;
  const isPositive = trend === "up";

  // Render Skeleton khi đang loading
  if (isLoading) {
    return (
      <div className="stat-card skeleton-card">
        <div className="sk-icon" />
        <div className="sk-content">
          <div className="sk-line w-50" />
          <div className="sk-line w-80 h-large" />
        </div>
      </div>
    );
  }

  return (
    <div className={`stat-card ${config.color}`}>
      <div className="card-header">
        <div className="icon-wrapper">
          <Icon size={20} strokeWidth={2} />
        </div>
        <div className={`trend-badge ${isPositive ? "positive" : "negative"}`}>
          {isPositive ? (
            <ArrowUpRight size={14} />
          ) : (
            <ArrowDownRight size={14} />
          )}
          <span>{Math.abs(trendValue)}%</span>
        </div>
      </div>

      <div className="card-main">
        <span className="stat-label">{config.label}</span>
        <h3 className="stat-value">{value}</h3>
        <p className="sub-text">so với hôm qua</p>
      </div>

      {/* Mini Chart (Sparkline) */}
      <div className="card-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData || SPARK_DATA}>
            <defs>
              <linearGradient id={`grad-${type}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="currentColor" stopOpacity={0.3} />
                <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="val"
              stroke="currentColor" // Dùng màu text hiện tại (theo class cha)
              fill={`url(#grad-${type})`}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const StatsGrid = ({ stats, isLoading }) => {
  // Map dữ liệu thực tế vào cấu trúc hiển thị
  // Trong thực tế, bạn sẽ lấy dữ liệu này từ props `stats`
  const cardsData = [
    {
      id: "rev",
      type: "revenue",
      value: stats?.revenue || "12.500.000 ₫",
      trend: "up",
      trendValue: 12.5,
      chartData: SPARK_DATA,
    },
    {
      id: "ord",
      type: "orders",
      value: stats?.orders || "145",
      trend: "up",
      trendValue: 8.2,
      chartData: SPARK_DATA,
    },
    {
      id: "cus",
      type: "customers",
      value: stats?.customers || "320",
      trend: "down", // Giả lập giảm
      trendValue: 2.4,
      chartData: SPARK_DATA_DOWN,
    },
    {
      id: "rat",
      type: "rating",
      value: stats?.rating || "4.8",
      trend: "up",
      trendValue: 5.0,
      chartData: SPARK_DATA,
    },
  ];

  return (
    <div className="stats-grid-container">
      {cardsData.map((item) => (
        <StatCard key={item.id} isLoading={isLoading} {...item} />
      ))}
    </div>
  );
};

export default StatsGrid;
