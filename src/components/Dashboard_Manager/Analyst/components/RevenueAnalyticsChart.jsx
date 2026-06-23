import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { ArrowDownRight, ArrowUpRight, BarChart3 } from "lucide-react";
import "./RevenueAnalyticsChart.scss";

const formatVnd = (value) =>
  `${new Intl.NumberFormat("vi-VN").format(Number(value || 0))}đ`;

const RevenueAnalyticsChart = ({ data = [], orderData = [], rangeLabel = "Kỳ đã chọn", loading }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const totalCurrent = data.reduce((sum, x) => sum + Number(x.current || 0), 0);
  const totalPrevious = data.reduce((sum, x) => sum + Number(x.previous || 0), 0);
  const completedOrders = orderData.reduce((sum, x) => sum + Number(x.current || 0), 0);
  const growth = totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : null;
  const hasCurrentRevenue = data.some((x) => Number(x.current || 0) > 0);
  const hasRevenueData = data.some((x) => Number(x.current || 0) > 0 || Number(x.previous || 0) > 0);
  const shouldShowGrowth = hasCurrentRevenue && growth !== null;

  useEffect(() => {
    if (!hasRevenueData) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
      return;
    }
    if (!chartRef.current) return;
    const ctx = chartRef.current.getContext("2d");
    if (chartInstance.current) chartInstance.current.destroy();
    chartInstance.current = new Chart(ctx, {
      type: "line",
      data: {
        labels: data.map((x) => x.key),
        datasets: [
          {
            label: "Kỳ này",
            data: data.map((x) => x.current),
            borderColor: "#6f7f7a",
            backgroundColor: "rgba(111, 127, 122, 0.1)",
            fill: true,
            borderWidth: 3,
            pointRadius: 2.5,
            pointHoverRadius: 5,
            tension: 0.35,
          },
          {
            label: "Kỳ trước",
            data: data.map((x) => x.previous),
            borderColor: "#cfc7ba",
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: "index" },
        plugins: {
          legend: { labels: { color: "#63706d", boxWidth: 10, boxHeight: 10, usePointStyle: true } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${formatVnd(ctx.raw)}`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#63706d" } },
          y: { beginAtZero: true, grid: { color: "rgba(128, 109, 83, 0.14)" }, ticks: { color: "#63706d" } },
        },
      },
    });
    return () => {
      chartInstance.current?.destroy();
      chartInstance.current = null;
    };
  }, [data, hasRevenueData]);

  return (
    <div className="revenue-analytics-card">
      <div className="chart-header">
        <div className="header-info">
          <h3>Nhịp doanh thu</h3>
          <p>Doanh thu kỳ này so với kỳ trước, chỉ tính dữ liệu đã ghi nhận.</p>
        </div>
        {shouldShowGrowth ? (
          <div className={`growth-indicator ${growth >= 0 ? "up" : "down"}`}>
            {growth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            <span>{Math.abs(growth).toFixed(1)}% so với kỳ trước</span>
          </div>
        ) : null}
      </div>

      <div className="revenue-summary-strip">
        <div>
          <span>Tổng doanh thu</span>
          <strong>{totalCurrent > 0 ? formatVnd(totalCurrent) : "Chưa có"}</strong>
        </div>
        <div>
          <span>Đơn hoàn tất</span>
          <strong>{completedOrders > 0 ? new Intl.NumberFormat("vi-VN").format(completedOrders) : "Chưa có"}</strong>
        </div>
        <div>
          <span>Khoảng thời gian</span>
          <strong>{rangeLabel}</strong>
        </div>
      </div>

      <div className={`chart-container ${hasRevenueData ? "has-data" : "is-empty"}`}>
        {loading ? <div className="chart-skeleton"><span /><span /><span /></div> : null}
        {!loading && hasRevenueData ? <canvas ref={chartRef}></canvas> : null}
        {!loading && !hasRevenueData ? (
          <div className="empty-state-inline" data-testid="revenue-empty-compact">
            <span className="empty-icon"><BarChart3 size={18} /></span>
            <strong>Chưa có doanh thu trong kỳ</strong>
            <p>Dữ liệu sẽ xuất hiện khi có đơn hoàn tất và thanh toán thành công.</p>
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page: "orders", source: "manager-analytics" } }))}>Xem đơn hàng</button>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RevenueAnalyticsChart;
