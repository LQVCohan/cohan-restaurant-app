import React, { useMemo } from "react";
import StatCard from "./StatCard";
import "./StatsGrid.scss";

const formatNumber = (value) =>
  typeof value === "number" ? value.toLocaleString("vi-VN") : value;

const StatsGrid = ({ stats = {}, loading = false }) => {
  const statsData = useMemo(() => {
    const avgRate = Math.round((stats.avgRate || 0) * 10) / 10;
    const formattedAvgRate = Number.isFinite(avgRate)
      ? avgRate.toFixed(1)
      : "0.0";

    return [
      {
        icon: "👥",
        number: loading ? "--" : formatNumber(stats.totalStaff || 0),
        label: "Tổng nhân viên",
        helper: loading
          ? "Đang tải dữ liệu nhân sự..."
          : "Bao gồm toàn bộ chi nhánh được phân quyền.",
        context: "Cập nhật từ danh sách sau bộ lọc.",
        badgeText: "Toàn hệ thống",
        badgeTone: "primary",
      },
      {
        icon: "✅",
        number: loading ? "--" : formatNumber(stats.activeStaff || 0),
        label: "Đang làm việc",
        helper: loading
          ? "Đang tải..."
          : `${formatNumber(stats.activeStaff || 0)} nhân viên đang làm việc.`,
        context: "Theo trạng thái việc làm hiện tại.",
        badgeText: "Ca đang hoạt động",
        badgeTone: "success",
      },
      {
        icon: "☕",
        number: loading ? "--" : formatNumber(stats.onLeaveStaff || 0),
        label: "Đang nghỉ phép",
        helper: loading
          ? "Đang tải..."
          : `${formatNumber(stats.onLeaveStaff || 0)} người nghỉ trong ngày.`,
        context: "Bao gồm nghỉ phép và tạm ngưng.",
        badgeText: "Tạm thời vắng",
        badgeTone: "warning",
      },
      {
        icon: "⭐",
        number: loading ? "--" : `${formattedAvgRate} / 5`,
        label: "Đánh giá trung bình",
        helper: loading
          ? "Đang tải..."
          : "Trung bình từ phản hồi nội bộ gần nhất.",
        context: "Cải thiện chất lượng dịch vụ.",
        badgeText: "Chất lượng",
        badgeTone: "info",
      },
    ];
  }, [loading, stats]);

  return (
    <div className="stats-grid">
      {statsData.map((stat, index) => (
        <StatCard key={index} loading={loading} {...stat} />
      ))}
    </div>
  );
};

export default StatsGrid;
