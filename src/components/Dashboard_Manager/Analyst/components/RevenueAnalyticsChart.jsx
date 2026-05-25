import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { ArrowUpRight, ArrowDownRight, BarChart3 } from "lucide-react";
import "./RevenueAnalyticsChart.scss";

const RevenueAnalyticsChart = ({ data = [], loading }) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const totalCurrent = data.reduce((sum, x) => sum + Number(x.current || 0), 0);
  const totalPrevious = data.reduce((sum, x) => sum + Number(x.previous || 0), 0);
  const growth = totalPrevious > 0 ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 : 0;
  const hasRevenueData = data.some((x) => Number(x.current || 0) > 0 || Number(x.previous || 0) > 0);

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
            borderColor: "#c5a47e",
            borderWidth: 3,
            tension: 0.35,
          },
          {
            label: "Kỳ trước",
            data: data.map((x) => x.previous),
            borderColor: "#cbd5e1",
            borderWidth: 2,
            borderDash: [5, 5],
            tension: 0.35,
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
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
          <h3>Biểu Đồ Doanh Thu</h3>
          {hasRevenueData ? (
            <div className="growth-indicator">
              {growth >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              <span>{Math.abs(growth).toFixed(1)}% so với kỳ trước</span>
            </div>
          ) : null}
        </div>
      </div>
      <div className="chart-container">
        {loading ? <div>Đang tải...</div> : null}
        {!loading && hasRevenueData ? <canvas ref={chartRef}></canvas> : null}
        {!loading && !hasRevenueData ? (
          <div className="empty-state-inline">
            <BarChart3 size={18} />
            <p>Chưa có doanh thu trong kỳ này.</p>
            <span>Dữ liệu sẽ xuất hiện khi có đơn hoàn tất và thanh toán thành công.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default RevenueAnalyticsChart;
