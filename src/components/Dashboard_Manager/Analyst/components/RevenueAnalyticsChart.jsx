import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { ArrowUpRight, Calendar } from "lucide-react";
import "./RevenueAnalyticsChart.scss";

const RevenueAnalyticsChart = () => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [timeFilter, setTimeFilter] = useState("today"); // 'today', 'week', 'month'

  // Dữ liệu giả lập theo từng filter
  const getChartData = (filter) => {
    // Trong thực tế, bạn sẽ gọi API ở đây
    if (filter === "week") {
      return {
        labels: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"],
        current: [
          1500000, 2100000, 1800000, 2400000, 3200000, 4500000, 3800000,
        ],
        previous: [
          1400000, 1900000, 1750000, 2200000, 2800000, 4100000, 3600000,
        ],
      };
    }
    // Default: Today
    return {
      labels: ["8h", "10h", "12h", "14h", "16h", "18h", "20h", "22h"],
      current: [
        450000, 800000, 2100000, 1200000, 950000, 1800000, 2500000, 1600000,
      ],
      previous: [
        400000, 750000, 1800000, 1300000, 900000, 1600000, 2200000, 1400000,
      ],
    };
  };

  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext("2d");

      // Tạo Gradient màu Vàng Luxury
      const gradient = ctx.createLinearGradient(0, 0, 0, 400);
      gradient.addColorStop(0, "rgba(197, 164, 126, 0.5)"); // Gold đậm
      gradient.addColorStop(1, "rgba(197, 164, 126, 0.0)"); // Trong suốt

      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      const data = getChartData(timeFilter);

      chartInstance.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: data.labels,
          datasets: [
            {
              label: "Kỳ này",
              data: data.current,
              borderColor: "#c5a47e", // Gold
              backgroundColor: gradient,
              borderWidth: 3,
              tension: 0.4, // Đường cong mềm mại
              fill: true,
              pointBackgroundColor: "#fff",
              pointBorderColor: "#c5a47e",
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
            },
            {
              label: "Kỳ trước", // So sánh với hôm qua/tuần trước
              data: data.previous,
              borderColor: "#cbd5e1", // Xám nhạt
              borderWidth: 2,
              borderDash: [5, 5], // Nét đứt
              tension: 0.4,
              fill: false,
              pointRadius: 0, // Ẩn point của đường so sánh cho đỡ rối
              pointHoverRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false,
          },
          plugins: {
            legend: {
              display: true,
              position: "top",
              align: "end",
              labels: {
                usePointStyle: true,
                boxWidth: 8,
                font: { family: "'Inter', sans-serif", size: 12 },
              },
            },
            tooltip: {
              backgroundColor: "rgba(26, 26, 26, 0.9)",
              titleColor: "#c5a47e",
              bodyColor: "#fff",
              padding: 12,
              cornerRadius: 8,
              callbacks: {
                label: function (context) {
                  let label = context.dataset.label || "";
                  if (label) {
                    label += ": ";
                  }
                  if (context.parsed.y !== null) {
                    label += new Intl.NumberFormat("vi-VN", {
                      style: "currency",
                      currency: "VND",
                    }).format(context.parsed.y);
                  }
                  return label;
                },
              },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: "#f1f5f9", // Grid màu rất nhạt
                borderDash: [5, 5],
              },
              border: { display: false }, // Bỏ đường kẻ trục Y
              ticks: {
                callback: (value) => {
                  if (value >= 1000000) return value / 1000000 + "tr";
                  return value / 1000 + "k";
                },
                color: "#94a3b8",
                font: { size: 11 },
              },
            },
            x: {
              grid: { display: false }, // Bỏ grid dọc
              border: { display: false },
              ticks: {
                color: "#64748b",
                font: { size: 12 },
              },
            },
          },
        },
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [timeFilter]); // Re-render khi filter thay đổi

  return (
    <div className="revenue-analytics-card">
      {/* Header: Tiêu đề & Bộ lọc */}
      <div className="chart-header">
        <div className="header-info">
          <h3>Biểu Đồ Doanh Thu</h3>
          <div className="growth-indicator">
            <ArrowUpRight size={16} />
            <span>+12.5% so với hôm qua</span>
          </div>
        </div>

        <div className="chart-filters">
          {["today", "week", "month"].map((filter) => (
            <button
              key={filter}
              className={`filter-btn ${timeFilter === filter ? "active" : ""}`}
              onClick={() => setTimeFilter(filter)}
            >
              {filter === "today"
                ? "Hôm nay"
                : filter === "week"
                ? "Tuần này"
                : "Tháng này"}
            </button>
          ))}
        </div>
      </div>

      {/* Body: Canvas Chart */}
      <div className="chart-container">
        <canvas ref={chartRef}></canvas>
      </div>
    </div>
  );
};

export default RevenueAnalyticsChart;
