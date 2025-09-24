import React, { useState } from "react";
import "./Chart.scss";

const Chart = () => {
  const [selectedPeriod, setSelectedPeriod] = useState("7days");

  const periods = [
    { value: "7days", label: "7 ngày qua" },
    { value: "30days", label: "30 ngày qua" },
    { value: "3months", label: "3 tháng qua" },
    { value: "year", label: "Năm nay" },
  ];

  const getPeriodLabel = (period) => {
    const periodMap = {
      "7days": "7 ngày qua",
      "30days": "30 ngày qua",
      "3months": "3 tháng qua",
      year: "năm nay",
    };
    return periodMap[period] || "7 ngày qua";
  };

  const handlePeriodChange = (e) => {
    setSelectedPeriod(e.target.value);
  };

  return (
    <div className="chart-card fade-in">
      <div className="chart-header">
        <h3 className="chart-title">📈 Biểu Đồ Doanh Thu</h3>
        <select
          className="chart-filter"
          value={selectedPeriod}
          onChange={handlePeriodChange}
        >
          {periods.map((period) => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>
      </div>
      <div className="chart-placeholder">
        📊 Biểu đồ doanh thu {getPeriodLabel(selectedPeriod)}
      </div>
    </div>
  );
};

export default Chart;
