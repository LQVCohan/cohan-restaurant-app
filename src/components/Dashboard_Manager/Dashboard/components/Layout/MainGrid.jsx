import React from "react";
import Chart from "../Chart";
import ActivityFeed from "../ActivityFeed";
import "./MainGrid.scss";

const MainGrid = () => {
  return (
    <div className="main-grid fade-in-up">
      {/* Khu vực Biểu đồ - Chiếm phần lớn diện tích */}
      <div className="grid-section chart-section">
        <Chart />
      </div>

      {/* Khu vực Hoạt động - Dạng cột bên phải */}
      <div className="grid-section feed-section">
        <div className="feed-container">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
};

export default MainGrid;
