import React, { useMemo } from "react";
import StatCard from "./StatCard";
import "./StatsGrid.scss";

const formatNumber = (value) =>
  typeof value === "number" ? value.toLocaleString("vi-VN") : value;

const StatsGrid = ({ stats = {}, loading = false }) => {
  const statsData = useMemo(
    () => [
      {
        icon: "👥",
        number: loading ? "--" : formatNumber(stats.totalStaff || 0),
        label: "Tổng nhân viên",
        trend: "up",
        trendValue: "+12%",
        change: loading ? "Đang tải..." : `${formatNumber(stats.totalStaff || 0)} người`,
        period: "Toàn bộ hệ thống",
        changeType: "positive",
      },
      {
        icon: "✅",
        number: loading ? "--" : formatNumber(stats.activeStaff || 0),
        label: "Đang làm việc",
        trend: "up",
        trendValue: "+5%",
        change: loading
          ? "Đang tải..."
          : `${formatNumber(stats.activeStaff || 0)} đang hoạt động`,
        period: "Hiện tại",
        changeType: "positive",
      },
      {
        icon: "☕",
        number: loading ? "--" : formatNumber(stats.onLeaveStaff || 0),
        label: "Đang nghỉ phép",
        trend: "stable",
        trendValue: "0%",
        change: loading
          ? "Đang tải..."
          : `${formatNumber(stats.onLeaveStaff || 0)} người nghỉ`,
        period: "Hôm nay",
        changeType: "neutral",
      },
      {
        icon: "⭐",
        number: loading
          ? "--"
          : `${Math.round((stats.avgRate || 0) * 10) / 10} / 5`,
        label: "Đánh giá trung bình",
        trend: "up",
        trendValue: "+1%",
        change: loading ? "Đang tải..." : "Cải thiện chất lượng",
        period: "Trong tháng",
        changeType: "positive",
      },
    ],
    [loading, stats]
  );

  return (
    <div className="stats-grid">
      {statsData.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
};

export default StatsGrid;
