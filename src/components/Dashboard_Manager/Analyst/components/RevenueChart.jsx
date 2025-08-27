import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

const RevenueChart = () => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      const ctx = chartRef.current.getContext("2d");

      // Destroy existing chart if it exists
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }

      chartInstance.current = new Chart(ctx, {
        type: "line",
        data: {
          labels: ["6h", "9h", "12h", "15h", "18h", "21h"],
          datasets: [
            {
              label: "Doanh thu (VNĐ)",
              data: [120000, 350000, 800000, 450000, 920000, 650000],
              borderColor: "#3b82f6",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              tension: 0.4,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 2,
          plugins: {
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                maxTicksLimit: 5,
                callback: function (value) {
                  return new Intl.NumberFormat("vi-VN").format(value) + "₫";
                },
              },
            },
            x: {
              ticks: {
                maxTicksLimit: 6,
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
  }, []);

  return <canvas ref={chartRef} width="300" height="150"></canvas>;
};

export default RevenueChart;
