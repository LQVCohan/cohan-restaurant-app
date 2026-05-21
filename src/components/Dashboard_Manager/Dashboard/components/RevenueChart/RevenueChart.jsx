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

const formatCurrency = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(val || 0));
const formatCompactVND = (value) => {
  const num = Number(value || 0);
  if (num === 0) return "0đ";
  if (Math.abs(num) < 1000000) return `${Math.round(num / 1000)}k`;
  const m = num / 1000000;
  return `${Number.isInteger(m) ? m : m.toFixed(1).replace(".", ",")}tr`;
};

const RevenueChart = ({ data = [], loading, compact = false }) => {
  const summary = useMemo(() => {
    const current = data.reduce((sum, x) => sum + Number(x.current || 0), 0);
    const previous = data.reduce((sum, x) => sum + Number(x.previous || 0), 0);
    const growth = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    return { current, growth, isPositive: growth >= 0 };
  }, [data]);

  return (
    <div className={`revenue-chart-widget ${compact ? "revenue-chart-widget--compact" : ""}`}>
      <div className="widget-header">
        <h3 className="widget-title">Tổng doanh thu</h3>
        <div className={`growth-badge ${summary.isPositive ? "positive" : "negative"}`}><span>{summary.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}</span><span>{Math.abs(summary.growth).toFixed(1)}%</span></div>
      </div>
      <p className="total-amount">{loading ? "..." : formatCurrency(summary.current)}</p>

      <ResponsiveContainer width="100%" height={compact ? 240 : 260}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
          <XAxis dataKey="key" axisLine={false} tickLine={false} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactVND} width={54} />
          <Tooltip formatter={(v) => formatCurrency(v)} />
          <Area type="monotone" dataKey="previous" stroke="#94a3b8" fillOpacity={0} />
          <Area type="monotone" dataKey="current" stroke="#2563eb" fillOpacity={0.2} fill="#2563eb" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RevenueChart;
