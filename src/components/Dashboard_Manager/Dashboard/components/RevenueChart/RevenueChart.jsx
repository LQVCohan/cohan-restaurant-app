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
  const m = num / 1000000;
  return `${Number.isInteger(m) ? m : m.toFixed(1).replace(".", ",")}tr`;
};

const formatChartDate = (value) => {
  const text = String(value || "").trim();
  const isoDate = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(value);
  }

  return text;
};

const RevenueChartSkeleton = () => (
  <div className="revenue-chart-skeleton" role="status" aria-live="polite">
    <span className="revenue-chart-skeleton__amount" />
    <span className="revenue-chart-skeleton__plot" />
    <span className="sr-only">Đang tải dữ liệu doanh thu</span>
  </div>
);

const RevenueChart = ({ data = [], loading, compact = false }) => {
  const safeData = Array.isArray(data) ? data : [];
  const hasRevenue = safeData.some((item) => Number(item?.current || 0) > 0);

  const summary = useMemo(() => {
    const current = safeData.reduce((sum, x) => sum + Number(x.current || 0), 0);
    const previous = safeData.reduce((sum, x) => sum + Number(x.previous || 0), 0);
    const hasComparison = previous > 0;
    const growth = hasComparison ? ((current - previous) / previous) * 100 : null;
    return { current, growth, isPositive: Number(growth || 0) >= 0, hasComparison };
  }, [safeData]);

  if (loading) return <RevenueChartSkeleton />;

  if (!hasRevenue) {
    return (
      <div className="revenue-chart-empty" role="status" aria-live="polite">
        <span className="revenue-chart-empty__icon" aria-hidden="true">
          <BarChart3 size={18} />
        </span>
        <strong>{formatCurrency(0)}</strong>
        <p>Chưa có doanh thu trong khoảng thời gian này.</p>
      </div>
    );
  }

  return (
    <div className={`revenue-chart-widget ${compact ? "revenue-chart-widget--compact" : ""}`}>
      <div className="widget-header">
        <div>
          <h3 className="widget-title">Tổng doanh thu</h3>
          <p className="total-amount">{formatCurrency(summary.current)}</p>
        </div>
        {summary.hasComparison ? (
          <div className={`growth-badge ${summary.isPositive ? "positive" : "negative"}`}>
            <span aria-hidden="true">{summary.isPositive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}</span>
            <span>{Math.abs(summary.growth).toFixed(1)}%</span>
          </div>
        ) : (
          <span className="comparison-note">Chưa có kỳ đối chiếu</span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={compact ? 220 : 260}>
        <AreaChart data={safeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee7dc" />
          <XAxis
            dataKey="key"
            axisLine={false}
            tickLine={false}
            tickFormatter={formatChartDate}
            tick={{ fill: "#78716c", fontSize: 12 }}
          />
          <YAxis axisLine={false} tickLine={false} tickFormatter={formatCompactVND} width={54} tick={{ fill: "#78716c", fontSize: 12 }} />
          <Tooltip
            formatter={(value, name) => [formatCurrency(value), name]}
            labelFormatter={(label) => `Ngày ${formatChartDate(label)}`}
            labelStyle={{ color: "#1f2933" }}
          />
          {summary.hasComparison ? (
            <Area
              type="monotone"
              dataKey="previous"
              name="Kỳ trước"
              stroke="#a8a29e"
              fillOpacity={0}
              strokeWidth={2}
            />
          ) : null}
          <Area
            type="monotone"
            dataKey="current"
            name="Kỳ hiện tại"
            stroke="#b45309"
            strokeWidth={2.5}
            fillOpacity={0.16}
            fill="#b45309"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export { formatChartDate };
export default RevenueChart;
