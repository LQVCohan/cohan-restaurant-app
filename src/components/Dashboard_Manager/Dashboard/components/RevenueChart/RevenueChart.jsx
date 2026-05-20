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

const formatCurrency = (val) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(val || 0));

const formatCompactVND = (value) => {
  const num = Number(value || 0);
  if (num === 0) return "0đ";
  if (Math.abs(num) < 1000000) return `${Math.round(num / 1000)}k`;
  const millions = num / 1000000;
  const rounded = Number.isInteger(millions) ? `${millions}` : millions.toFixed(1).replace(".", ",");
  return `${rounded}tr`;
};

const RevenueChart = ({ data = [], loading }) => {
  const summary = useMemo(() => {
    const current = data.reduce((sum, x) => sum + Number(x.current || 0), 0);
    const previous = data.reduce((sum, x) => sum + Number(x.previous || 0), 0);
    const growth = previous > 0 ? ((current - previous) / previous) * 100 : 0;
    const hasCurrentRevenue = data.some((x) => Number(x?.current || 0) > 0);
    return { current, growth, isPositive: growth >= 0, hasCurrentRevenue };
  }, [data]);

  const shouldShowEmpty = !loading && summary.current <= 0 && !summary.hasCurrentRevenue;

  return (
    <div className="revenue-chart-widget">
      <div className="widget-header">
        <div className="header-info">
          <h3 className="widget-title">Tổng doanh thu</h3>
          <div className="total-value-group">
            <span className="total-amount">
              {loading ? "..." : formatCurrency(summary.current)}
            </span>
            {!shouldShowEmpty ? (
              <div className={`growth-badge ${summary.isPositive ? "positive" : "negative"}`}>
                {summary.isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                <span>{Math.abs(summary.growth).toFixed(1)}%</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="widget-body">
        {shouldShowEmpty ? (
          <div className="chart-empty-state" role="status" aria-live="polite">
            <BarChart3 size={20} />
            <h4>Chưa có dữ liệu doanh thu.</h4>
            <p>Dữ liệu sẽ xuất hiện khi có đơn hàng hoàn tất trong khoảng thời gian này.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="key" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactVND} width={54} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Area type="monotone" dataKey="previous" stroke="#94a3b8" fillOpacity={0} />
              <Area type="monotone" dataKey="current" stroke="#d97706" fillOpacity={0.25} fill="#d97706" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default RevenueChart;
