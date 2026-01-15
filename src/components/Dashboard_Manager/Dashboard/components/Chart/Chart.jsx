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
  MoreHorizontal,
  Calendar,
} from "lucide-react";
import "./Chart.scss";

// Dữ liệu giả lập cho các mốc thời gian khác nhau
const MOCK_DATA = {
  "7days": {
    data: [
      { name: "T2", value: 12500000 },
      { name: "T3", value: 18000000 },
      { name: "T4", value: 15000000 },
      { name: "T5", value: 22000000 },
      { name: "T6", value: 28500000 },
      { name: "T7", value: 32000000 },
      { name: "CN", value: 38000000 },
    ],
    total: 166000000,
    percent: 12.5,
    isGrowth: true,
  },
  "30days": {
    data: [
      { name: "Tuần 1", value: 150000000 },
      { name: "Tuần 2", value: 180000000 },
      { name: "Tuần 3", value: 160000000 },
      { name: "Tuần 4", value: 210000000 },
    ],
    total: 700000000,
    percent: 5.2,
    isGrowth: true,
  },
  year: {
    data: [
      { name: "Q1", value: 500000000 },
      { name: "Q2", value: 450000000 },
      { name: "Q3", value: 600000000 },
      { name: "Q4", value: 800000000 },
    ],
    total: 2350000000,
    percent: -2.4,
    isGrowth: false,
  },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip-card">
        <p className="tooltip-label">{label}</p>
        <div className="tooltip-divider"></div>
        <p className="tooltip-value">
          {new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
          }).format(payload[0].value)}
        </p>
        <p className="tooltip-desc">Doanh thu thuần</p>
      </div>
    );
  }
  return null;
};

const Chart = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("7days");

  // Lấy data hiện tại dựa trên state
  const currentData = useMemo(
    () => MOCK_DATA[selectedPeriod],
    [selectedPeriod]
  );

  const periods = [
    { value: "7days", label: "7 ngày" },
    { value: "30days", label: "30 ngày" },
    { value: "year", label: "Năm" },
  ];

  return (
    <div className="dashboard-widget revenue-chart">
      {/* Header Widget */}
      <div className="widget-header">
        <div className="header-left">
          <h3 className="widget-title">Doanh Thu</h3>
          <div className="total-revenue-group">
            <h2 className="total-amount">
              {new Intl.NumberFormat("vi-VN").format(currentData.total)}
              <span className="currency-symbol">đ</span>
            </h2>
            <div
              className={`trend-badge ${currentData.isGrowth ? "up" : "down"}`}
            >
              {currentData.isGrowth ? (
                <ArrowUpRight size={14} />
              ) : (
                <ArrowDownRight size={14} />
              )}
              <span>{Math.abs(currentData.percent)}%</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          {/* Segmented Control for Time */}
          <div className="segmented-control">
            {periods.map((period) => (
              <button
                key={period.value}
                className={`segment-btn ${
                  selectedPeriod === period.value ? "active" : ""
                }`}
                onClick={() => setSelectedPeriod(period.value)}
              >
                {period.label}
              </button>
            ))}
          </div>
          <button className="btn-icon-more">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Chart Content */}
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={currentData.data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f3f4f6"
            />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#6b7280", fontSize: 12, fontWeight: 500 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#9ca3af", fontSize: 11 }}
              tickFormatter={(value) => {
                if (value >= 1000000000)
                  return `${(value / 1000000000).toFixed(1)}B`;
                if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                return value;
              }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "#d97706",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#d97706"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              activeDot={{ r: 6, strokeWidth: 0, fill: "#d97706" }}
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Chart;
