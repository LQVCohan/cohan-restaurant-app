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
import { ArrowUpRight, TrendingUp } from "lucide-react";
import "./RevenueChart.scss";

// Mock Data: Dữ liệu giả lập cho 3 mốc thời gian
const DATA_WEEK = [
  { name: "T2", value: 15000000 },
  { name: "T3", value: 23500000 },
  { name: "T4", value: 18200000 },
  { name: "T5", value: 32000000 },
  { name: "T6", value: 29500000 },
  { name: "T7", value: 45000000 },
  { name: "CN", value: 52000000 },
];

const DATA_MONTH = [
  { name: "W1", value: 120000000 },
  { name: "W2", value: 180000000 },
  { name: "W3", value: 150000000 },
  { name: "W4", value: 210000000 },
];

const RevenueChart = () => {
  const [filter, setFilter] = useState("week"); // week | month | year
  const [data, setData] = useState(DATA_WEEK);

  // Xử lý chuyển tab lọc
  const handleFilterChange = (key) => {
    setFilter(key);
    // Logic giả lập thay đổi data
    if (key === "month") setData(DATA_MONTH);
    else setData(DATA_WEEK);
  };

  // Format tiền tệ trục Y (Rút gọn: 10M, 20M...)
  const formatYAxis = (value) => {
    if (value >= 1000000) return `${value / 1000000}M`;
    return value;
  };

  // Custom Tooltip: Hiển thị chi tiết khi rê chuột
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="label">{`Thứ ${label}`}</p>
          <p className="value">
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

  return (
    <div className="revenue-chart-container">
      {/* 1. Header: Title & Filters */}
      <div className="chart-header">
        <div className="title-group">
          <h3>Biểu Đồ Doanh Thu</h3>
          <div className="growth-badge">
            <ArrowUpRight size={16} />
            <span>+24.5%</span>
            <span className="text-muted">so với tuần trước</span>
          </div>
        </div>

        <div className="filter-tabs">
          {["week", "month", "year"].map((key) => (
            <button
              key={key}
              className={`filter-btn ${filter === key ? "active" : ""}`}
              onClick={() => handleFilterChange(key)}
            >
              {key === "week"
                ? "7 ngày"
                : key === "month"
                ? "30 ngày"
                : "Năm nay"}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Chart Area */}
      <div className="chart-body">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
          >
            {/* Định nghĩa Gradient màu vàng */}
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c5a47e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#c5a47e" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Lưới ngang mờ */}
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f1f5f9"
            />

            {/* Trục X */}
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
              dy={10}
            />

            {/* Trục Y */}
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12 }}
              tickFormatter={formatYAxis}
              width={40}
            />

            {/* Tooltip Custom */}
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "#c5a47e",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />

            {/* Đường vẽ Area */}
            <Area
              type="monotone" // Đường cong mềm mại
              dataKey="value"
              stroke="#c5a47e" // Màu viền Vàng Luxury
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRevenue)" // Link tới gradient bên trên
              activeDot={{ r: 6, strokeWidth: 0, fill: "#1a1a1a" }} // Chấm tròn khi hover
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
