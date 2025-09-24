import React from "react";
import StatsGrid from "./components/StatsGrid";
import Header from "./components/Header";
import QuickActions from "./components/QuickActions";
import MainGrid from "./components/Layout/MainGrid";
import BottomGrid from "./components/Layout/BottomGrid";
import { useDashboard } from "../../../hooks/useDashboard";
import "./Dashboard.scss";

const Dashboard = () => {
  const {
    selectedRestaurant,
    stats,
    handleRestaurantChange,
    handleSwitchToPOS,
    handleGenerateReport,
  } = useDashboard();

  return (
    <div className="dashboard">
      <Header
        selectedRestaurant={selectedRestaurant}
        onRestaurantChange={handleRestaurantChange}
        onSwitchToPOS={handleSwitchToPOS}
        onGenerateReport={handleGenerateReport}
      />

      <StatsGrid stats={stats} />

      <QuickActions />

      <MainGrid />

      <BottomGrid />
    </div>
  );
};

export default Dashboard;
