import React, { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowUpRight, Calendar } from "lucide-react";
import "./Chart.scss";

// Dữ liệu giả lập cho biểu đồ (Mock Data)
const data = [
  { name: "T2", value: 12500000 },
  { name: "T3", value: 18000000 },
  { name: "T4", value: 15000000 },
  { name: "T5", value: 22000000 },
  { name: "T6", value: 28500000 },
  { name: "T7", value: 32000000 },
  { name: "CN", value: 35000000 },
];

// Custom Tooltip để hiển thị thông tin khi hover chuột vào biểu đồ
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-chart-tooltip">
        <p className="tooltip-label">{`Thứ ${label}`}</p>
        <p className="tooltip-value">
          {new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
          }).format(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const Chart = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("7days");

  const periods = [
    { value: "7days", label: "7 ngày" },
    { value: "30days", label: "30 ngày" },
    { value: "year", label: "Năm nay" },
  ];

  return (
    <div className="chart-wrapper fade-in">
      <div className="chart-header">
        <div className="title-group">
          <h3 className="chart-title">Biểu Đồ Doanh Thu</h3>
          <div className="chart-summary">
            <ArrowUpRight size={16} className="trend-icon" />
            <span className="trend-value">+24.5%</span>
            <span className="trend-label">so với tuần trước</span>
          </div>
        </div>

        {/* Tab chọn thời gian thay vì Select Dropdown */}
        <div className="period-tabs">
          {periods.map((period) => (
            <button
              key={period.value}
              className={`tab-btn ${
                selectedPeriod === period.value ? "active" : ""
              }`}
              onClick={() => setSelectedPeriod(period.value)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c5a47e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c5a47e" stopOpacity={0} />
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
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickFormatter={(value) => `${value / 1000000}M`}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "#c5a47e",
                strokeWidth: 1,
                strokeDasharray: "5 5",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#c5a47e" // Màu Gold cho đường viền
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRevenue)" // Gradient fill
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Chart;
