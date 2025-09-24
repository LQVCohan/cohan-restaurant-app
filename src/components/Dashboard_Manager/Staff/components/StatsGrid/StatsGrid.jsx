import React from "react";
import StatCard from "./StatCard";
import "./StatsGrid.scss";

const StatsGrid = ({ stats }) => {
  const statsData = [
    {
      icon: "👥",
      number: stats.totalEmployees || 247,
      label: "Tổng nhân viên",
      trend: "up",
      trendValue: "+12%",
      change: "+28 người",
      period: "Tháng này",
      changeType: "positive",
    },
    {
      icon: "✅",
      number: stats.activeEmployees || 189,
      label: "Đang làm việc",
      trend: "up",
      trendValue: "+5%",
      change: "+9 người",
      period: "Hôm nay",
      changeType: "positive",
    },
    {
      icon: "☕",
      number: stats.onBreak || 32,
      label: "Đang nghỉ giải lao",
      trend: "stable",
      trendValue: "0%",
      change: "Không đổi",
      period: "So với hôm qua",
      changeType: "neutral",
    },
    {
      icon: "❌",
      number: stats.absent || 26,
      label: "Vắng mặt",
      trend: "down",
      trendValue: "-3%",
      change: "-2 người",
      period: "Hôm nay",
      changeType: "negative",
    },
  ];

  return (
    <div className="stats-grid">
      {statsData.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};

export default StatsGrid;
