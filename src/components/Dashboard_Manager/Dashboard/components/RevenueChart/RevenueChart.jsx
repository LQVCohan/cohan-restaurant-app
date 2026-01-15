import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  MoreHorizontal,
  DollarSign,
} from "lucide-react";
import "./RevenueChart.scss";

// Mock Data: Cấu trúc mới bao gồm current (kỳ này) và previous (kỳ trước)
const DATA_WEEK = [
  { name: "T2", current: 15000000, previous: 12000000 },
  { name: "T3", current: 23500000, previous: 20000000 },
  { name: "T4", current: 18200000, previous: 22000000 }, // Giảm
  { name: "T5", current: 32000000, previous: 25000000 },
  { name: "T6", current: 29500000, previous: 28000000 },
  { name: "T7", current: 45000000, previous: 35000000 },
  { name: "CN", current: 52000000, previous: 48000000 },
];

const DATA_MONTH = [
  { name: "Tuần 1", current: 120000000, previous: 110000000 },
  { name: "Tuần 2", current: 180000000, previous: 150000000 },
  { name: "Tuần 3", current: 150000000, previous: 160000000 },
  { name: "Tuần 4", current: 210000000, previous: 190000000 },
];

const RevenueChart = () => {
  const [filter, setFilter] = useState("week");
  const [data, setData] = useState(DATA_WEEK);

  // 1. Tính toán tổng quan (Summary Stats)
  const summary = useMemo(() => {
    const totalCurrent = data.reduce((acc, item) => acc + item.current, 0);
    const totalPrev = data.reduce((acc, item) => acc + item.previous, 0);
    const growth = ((totalCurrent - totalPrev) / totalPrev) * 100;

    return {
      total: totalCurrent,
      growth: growth.toFixed(1),
      isPositive: growth >= 0,
    };
  }, [data]);

  const handleFilterChange = (key) => {
    setFilter(key);
    // Giả lập loading hoặc switch data
    if (key === "month") setData(DATA_MONTH);
    else setData(DATA_WEEK);
  };

  const formatCurrency = (value) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
    return value;
  };

  const formatTooltipCurrency = (val) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(val);

  // 2. Custom Tooltip Nâng cao
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const currentVal = payload[0].value;
      const prevVal = payload[1].value;
      const diff = ((currentVal - prevVal) / prevVal) * 100;
      const isUp = diff >= 0;

      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{label}</p>
          <div className="tooltip-row highlight">
            <span className="dot current"></span>
            <span>Hiện tại:</span>
            <span className="value">{formatTooltipCurrency(currentVal)}</span>
          </div>
          <div className="tooltip-row">
            <span className="dot previous"></span>
            <span>Kỳ trước:</span>
            <span className="value">{formatTooltipCurrency(prevVal)}</span>
          </div>
          <div className={`tooltip-diff ${isUp ? "up" : "down"}`}>
            {isUp ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{Math.abs(diff).toFixed(1)}% so với kỳ trước</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="revenue-chart-widget">
      {/* HEADER */}
      <div className="widget-header">
        <div className="header-info">
          <h3 className="widget-title">Tổng Doanh Thu</h3>
          <div className="total-value-group">
            <span className="total-amount">
              {formatTooltipCurrency(summary.total)}
            </span>
            <div
              className={`growth-badge ${
                summary.isPositive ? "positive" : "negative"
              }`}
            >
              {summary.isPositive ? (
                <ArrowUpRight size={16} />
              ) : (
                <ArrowDownRight size={16} />
              )}
              <span>{Math.abs(summary.growth)}%</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          {/* Tab Filter */}
          <div className="filter-tabs">
            {["week", "month"].map((key) => (
              <button
                key={key}
                className={`tab-btn ${filter === key ? "active" : ""}`}
                onClick={() => handleFilterChange(key)}
              >
                {key === "week" ? "Tuần này" : "Tháng này"}
              </button>
            ))}
          </div>
          {/* More Option Button */}
          <button className="btn-icon">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* CHART BODY */}
      <div className="widget-body">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              {/* Gradient cho Current Data (Màu Amber sang trọng) */}
              <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
              </linearGradient>
              {/* Gradient cho Previous Data (Màu Xám mờ) */}
              <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f1f5f9"
            />

            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
              dy={10}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              tickFormatter={formatCurrency}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "#d97706",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />

            {/* Area 1: Previous Period (Vẽ trước để nằm dưới) */}
            <Area
              type="monotone"
              dataKey="previous"
              stroke="#94a3b8"
              strokeWidth={2}
              strokeDasharray="5 5" // Nét đứt biểu thị dữ liệu quá khứ
              fill="url(#colorPrev)"
              activeDot={false}
            />

            {/* Area 2: Current Period (Nổi bật) */}
            <Area
              type="monotone"
              dataKey="current"
              stroke="#d97706" // Amber-600
              strokeWidth={3}
              fill="url(#colorCurrent)"
              activeDot={{
                r: 6,
                strokeWidth: 4,
                stroke: "#fff",
                fill: "#d97706",
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="widget-footer">
        <div className="legend-item">
          <span className="dot current"></span> Doanh thu kỳ này
        </div>
        <div className="legend-item">
          <span className="dot previous"></span> Kỳ trước
        </div>
      </div>
    </div>
  );
};

export default RevenueChart;
