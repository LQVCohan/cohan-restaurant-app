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
    { id: "active", icon: "🟢", label: "Đang trực tuyến", value: stats.activeStaff || 0, suffix: "Online" },
    { id: "leave", icon: "📅", label: "Nghỉ phép", value: stats.onLeaveStaff || 0, suffix: "Hôm nay" },
    { id: "rate", icon: "⭐", label: "Đánh giá TB", value: (Math.round((stats.avgRate || 0) * 10) / 10).toFixed(1), suffix: "/5.0" },
  ]), [stats]);

  return <ManagementPageHeader
    className="staff-page-header"
    eyebrow="HR MANAGER"
    title={isCollapsed ? "Nhân Sự" : "Quản Lý Nhân Sự"}
    subtitle="Theo dõi hoạt động nhân sự theo thời gian thực."
    stats={statsData}
    loading={loading}
    isCollapsed={isCollapsed}
    onToggle={onToggle}
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder={isCollapsed ? "Tìm kiếm..." : "Tìm tên nhân viên, mã số..."}
    selectedRestaurant={selectedRestaurant}
    onRestaurantChange={onRestaurantChange}
    restaurantList={restaurantList}
    quickActions={[
      { icon: "📝", label: "Điểm Danh", onClick: () => onPageChange?.("attendance") },
      { icon: "📅", label: "Xếp Ca", onClick: () => onPageChange?.("schedule") },
      { icon: "🏖️", label: "Nghỉ Phép", onClick: () => onPageChange?.("leave") },
    ]}
    secondaryActions={onExportData ? [{ icon: "📤", label: "Export", onClick: onExportData }] : []}
    primaryAction={onAddEmployee ? { icon: "➕", label: isCollapsed ? "" : "Thêm Nhân Sự", onClick: onAddEmployee } : null}
    footerLeft={<span>Đang trực tuyến: <strong>{loading ? "--" : (stats.activeStaff || 0)}</strong></span>}
    footerRight={<span>Cần duyệt: <strong>{loading ? "--" : pendingLeaveCount} Nghỉ phép</strong></span>}
  />;
};

export default StaffHeader;
