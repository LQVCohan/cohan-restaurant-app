import React, { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import "./RevenueChart.scss";

const formatCurrency = (val) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(val || 0));

const RevenueChart = ({ data = [], loading, range, onRangeChange }) => {
  const summary = useMemo(() => {
    const current = data.reduce((sum, x) => sum + Number(x.current || 0), 0);
    const previous = data.reduce((sum, x) => sum + Number(x.previous || 0), 0);
    const growth = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    return { current, growth, isPositive: growth >= 0 };
  }, [data]);

  return (
    <div className="revenue-chart-widget">
      <div className="widget-header">
        <div className="header-info">
          <h3 className="widget-title">Tổng Doanh Thu</h3>
          <div className="total-value-group">
            <span className="total-amount">
              {loading ? "..." : formatCurrency(summary.current)}
            </span>
            <div className={`growth-badge ${summary.isPositive ? "positive" : "negative"}`}>
              {summary.isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              <span>{Math.abs(summary.growth).toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div className="filter-tabs">
          <button
            className={`tab-btn ${range === "week" ? "active" : ""}`}
            onClick={() => onRangeChange?.("week")}
          >
            Tuần này
          </button>
          <button
            className={`tab-btn ${range === "month" ? "active" : ""}`}
            onClick={() => onRangeChange?.("month")}
          >
            Tháng này
          </button>
        </div>
      </div>

      <div className="widget-body">
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="key" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Area type="monotone" dataKey="previous" stroke="#94a3b8" fillOpacity={0} />
            <Area type="monotone" dataKey="current" stroke="#d97706" fillOpacity={0.25} fill="#d97706" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RevenueChart;
