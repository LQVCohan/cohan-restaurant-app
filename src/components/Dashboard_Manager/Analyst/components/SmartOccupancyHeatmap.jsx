import React, { useState } from "react";
import { CloudRain, Sun, History, TrendingUp, AlertCircle } from "lucide-react";
import "./SmartOccupancyHeatmap.scss";

const SmartOccupancyHeatmap = () => {
  const [viewMode, setViewMode] = useState("forecast"); // 'history' | 'forecast'

  const hours = ["10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
  const days = [
    { label: "T2", full: "Thứ 2", date: "29/12" },
    { label: "T3", full: "Thứ 3", date: "30/12" },
    { label: "T4", full: "Thứ 4", date: "31/12" },
    { label: "T5", full: "Thứ 5", date: "01/01" },
    { label: "T6", full: "Thứ 6", date: "02/01" },
    { label: "T7", full: "Thứ 7", date: "03/01" },
    { label: "CN", full: "Chủ Nhật", date: "04/01" },
  ];

  // Logic sinh dữ liệu giả lập (Giữ nguyên logic cũ)
  const generateData = (dayIndex, hourIndex) => {
    let occupancy = Math.random() * 0.4;
    if (hourIndex === 1) occupancy += 0.3; // Trưa
    if (hourIndex === 4 || hourIndex === 5) occupancy += 0.5; // Tối
    if (dayIndex > 4) occupancy += 0.2; // Cuối tuần
    if (occupancy > 1) occupancy = 1;

    let weather = null;
    let event = null;
    if (viewMode === "forecast") {
      if (dayIndex === 4 && hourIndex > 3) weather = "rain";
      if (dayIndex === 2 && hourIndex > 4) event = "Countdown";
    }

    return {
      value: occupancy,
      weather,
      event,
      staffRequired: Math.ceil(occupancy * 12) + 2,
    };
  };

  return (
    <div className="widget-card smart-heatmap-widget">
      {/* HEADER */}
      <div className="widget-header">
        <div className="header-info">
          <h4>Mật Độ & Dự Báo</h4>
          <div className="mode-switch">
            <button
              className={viewMode === "history" ? "active" : ""}
              onClick={() => setViewMode("history")}
            >
              <History size={14} /> <span>Lịch sử</span>
            </button>
            <button
              className={viewMode === "forecast" ? "active" : ""}
              onClick={() => setViewMode("forecast")}
            >
              <TrendingUp size={14} /> <span>Dự báo</span>
            </button>
          </div>
        </div>

        <div className="heatmap-legend">
          <div className="legend-track"></div>
          <div className="legend-labels">
            <span>Vắng</span>
            <span>Đông</span>
          </div>
        </div>
      </div>

      {/* HEATMAP BODY (Scrollable Area) */}
      <div className="heatmap-scroll-wrapper">
        <div className="heatmap-grid">
          {/* 1. Header Row (Giờ) */}
          <div className="grid-cell header-corner"></div>{" "}
          {/* Ô trống góc trên trái */}
          {hours.map((h) => (
            <div key={h} className="grid-cell header-hour">
              {h}
            </div>
          ))}
          {/* 2. Data Rows (Ngày + Các ô dữ liệu) */}
          {days.map((day, dIndex) => (
            <React.Fragment key={dIndex}>
              {/* Cột Tên Ngày */}
              <div className="grid-cell row-label">
                <span className="lbl-day">{day.label}</span>
                <span className="lbl-date">{day.date}</span>
              </div>

              {/* Các ô dữ liệu của ngày đó */}
              {hours.map((hour, hIndex) => {
                const data = generateData(dIndex, hIndex);
                const opacity = Math.max(0.1, data.value);

                return (
                  <div
                    key={`${dIndex}-${hIndex}`}
                    className={`grid-cell data-cell ${
                      data.value > 0.85 ? "high-load" : ""
                    }`}
                    style={{ "--bg-opacity": opacity }}
                  >
                    <div className="cell-bg"></div>

                    {data.weather === "rain" && (
                      <CloudRain size={14} className="icon-weather" />
                    )}
                    {data.event && <span className="badge-event">Event</span>}

                    {/* TOOLTIP */}
                    <div className="cell-tooltip">
                      <div className="tt-head">
                        <strong>
                          {day.full}, {hour}
                        </strong>
                        {data.weather && <span>🌧 Mưa</span>}
                      </div>
                      <div className="tt-stat">
                        Khách: {Math.round(data.value * 100)}%
                      </div>
                      <div className="tt-stat">
                        Cần: <strong>{data.staffRequired} NV</strong>
                      </div>
                      {data.value > 0.85 && (
                        <div className="tt-warn">
                          <AlertCircle size={10} /> Quá tải
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* FOOTER INSIGHT */}
      {viewMode === "forecast" && (
        <div className="forecast-insight">
          <Sun size={16} className="icon" />
          <span>
            <strong>AI Note:</strong> Tối 31/12 (Countdown) cần tăng{" "}
            <strong>+4 NV</strong> Part-time.
          </span>
        </div>
      )}
    </div>
  );
};

export default SmartOccupancyHeatmap;
