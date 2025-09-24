import React from "react";
import Chart from "../Chart";
import ActivityFeed from "../ActivityFeed";
import "./MainGrid.scss";

const MainGrid = () => {
  return (
    <div className="main-grid">
      <Chart />
      <ActivityFeed />
    </div>
  );
};

export default MainGrid;
