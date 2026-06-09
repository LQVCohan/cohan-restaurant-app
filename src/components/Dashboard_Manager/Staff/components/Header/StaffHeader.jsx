import React, { useMemo } from "react";
import ManagementPageHeader from "../../../shared/ManagementPageHeader";
import "./StaffHeader.scss";

const StaffHeader = ({
  selectedRestaurant,
  onRestaurantChange,
  onAddEmployee,
  onExportData,
  restaurantList = [],
  stats = {},
  loading = false,
  onPageChange,
  isCollapsed,
  onToggle,
  searchValue = "",
  onSearchChange,
  pendingLeaveCount = 0,
}) => {
  const statsData = useMemo(() => ([
    { id: "total", icon: "👥", label: "Tổng nhân sự", value: stats.totalStaff || 0 },
    { id: "active", icon: "🟢", label: "Trực tuyến", value: stats.activeStaff || 0, suffix: "đang hoạt động" },
    { id: "leave", icon: "📅", label: "Nghỉ phép", value: stats.onLeaveStaff || 0, suffix: "hôm nay" },
    { id: "rate", icon: "⭐", label: "Đánh giá TB", value: (Math.round((stats.avgRate || 0) * 10) / 10).toFixed(1), suffix: "/5.0" },
  ]), [stats]);

  return <ManagementPageHeader
    className="staff-page-header"
    density="compact"
    eyebrow="HR MANAGER"
    title={isCollapsed ? "Nhân sự" : "Quản lý nhân sự"}
    subtitle="Theo dõi hoạt động nhân sự theo thời gian thực."
    stats={statsData}
    loading={loading}
    isCollapsed={isCollapsed}
    onToggle={onToggle}
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder={isCollapsed ? "Tìm kiếm..." : "Tìm tên, mã nhân viên..."}
    selectedRestaurant={selectedRestaurant}
    onRestaurantChange={onRestaurantChange}
    restaurantList={restaurantList}
    quickActions={[
      { icon: "📝", label: "Điểm danh", title: "Điểm danh nhân sự", onClick: () => onPageChange?.("attendance") },
      { icon: "📅", label: "Xếp ca", title: "Xếp ca làm việc", onClick: () => onPageChange?.("schedule") },
      { icon: "🏖️", label: "Nghỉ phép", title: "Quản lý nghỉ phép", onClick: () => onPageChange?.("leave") },
    ]}
    secondaryActions={onExportData ? [{ icon: "📤", label: "Xuất dữ liệu", onClick: onExportData }] : []}
    primaryAction={onAddEmployee ? { icon: "➕", label: isCollapsed ? "" : "Thêm nhân sự", onClick: onAddEmployee } : null}
    footerLeft={<span>Trực tuyến: <strong>{loading ? "--" : (stats.activeStaff || 0)}</strong></span>}
    footerRight={<span>Cần duyệt: <strong>{loading ? "--" : pendingLeaveCount} nghỉ phép</strong></span>}
  />;
};

export default StaffHeader;
