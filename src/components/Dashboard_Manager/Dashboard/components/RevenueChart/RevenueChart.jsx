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
import { ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react";
import "./RevenueChart.scss";

const formatCurrency = (val) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(val || 0));
const formatCompactVND = (value) => {
  const num = Number(value || 0);
  if (num === 0) return "0đ";
  if (Math.abs(num) < 1000000) return `${Math.round(num / 1000)}k`;
  const m = num / 1000000;
  return `${Number.isInteger(m) ? m : m.toFixed(1).replace(".", ",")}tr`;
};

const RevenueChart = ({ data = [], loading }) => {
  const summary = useMemo(() => {
    const current = data.reduce((sum, x) => sum + Number(x.current || 0), 0);
    const previous = data.reduce((sum, x) => sum + Number(x.previous || 0), 0);
    const growth = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    return { current, growth, isPositive: growth >= 0 };
  }, [data]);

  const shouldShowEmpty = !loading && summary.current <= 0;

  return (
    <div className="revenue-chart-widget">
      <div className="widget-header">
        <h3 className="widget-title">Tổng doanh thu</h3>
        {!shouldShowEmpty ? <div className={`growth-badge ${summary.isPositive ? "positive" : "negative"}`}>{summary.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}<span>{Math.abs(summary.growth).toFixed(1)}%</span></div> : null}
      </div>
      <p className="total-amount">{loading ? "..." : formatCurrency(summary.current)}</p>

      {shouldShowEmpty ? (
        <div className="chart-empty-state" role="status" aria-live="polite">
          <BarChart3 size={18} />
          <h4>Chưa có doanh thu trong khoảng thời gian này.</h4>
          <p>Dữ liệu sẽ xuất hiện khi có đơn hàng hoàn tất.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
            <XAxis dataKey="key" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactVND} width={54} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Area type="monotone" dataKey="previous" stroke="#94a3b8" fillOpacity={0} />
            <Area type="monotone" dataKey="current" stroke="#2563eb" fillOpacity={0.2} fill="#2563eb" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

export default RevenueChart;
