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
    { id: "total", icon: "👥", label: "Tổng nhân viên", value: stats.totalStaff || 0 },
    { id: "active", icon: "🟢", label: "Đang trực tuyến", value: stats.activeStaff || 0, suffix: "nhân viên" },
    { id: "leave", icon: "📅", label: "Đang nghỉ phép", value: stats.onLeaveStaff || 0, suffix: "hồ sơ" },
    { id: "rate", icon: "⭐", label: "Hiệu suất TB", value: (Math.round((stats.avgRate || 0) * 10) / 10).toFixed(1), suffix: "/5.0" },
  ]), [stats]);

  return <ManagementPageHeader
    className="staff-page-header"
    density="compact"
    eyebrow="TRUNG TÂM NHÂN SỰ"
    title={isCollapsed ? "Nhân sự" : "Quản lý nhân sự"}
    subtitle="Theo dõi hồ sơ, trạng thái làm việc, chấm công và phân công nhân viên theo từng nhà hàng."
    stats={statsData}
    loading={loading}
    isCollapsed={isCollapsed}
    onToggle={onToggle}
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder={isCollapsed ? "Tìm nhân viên..." : "Tìm tên, mã nhân viên, SĐT..."}
    selectedRestaurant={selectedRestaurant}
    onRestaurantChange={onRestaurantChange}
    restaurantList={restaurantList}
    quickActions={[
      { icon: "📝", label: "Chấm công", title: "Điểm danh và theo dõi chấm công", onClick: () => onPageChange?.("attendance") },
      { icon: "📅", label: "Xếp ca", title: "Xếp ca làm việc", onClick: () => onPageChange?.("schedule") },
      { icon: "🏖️", label: "Nghỉ phép", title: "Duyệt và theo dõi nghỉ phép", onClick: () => onPageChange?.("leave") },
    ]}
    secondaryActions={onExportData ? [{ icon: "📤", label: "Xuất dữ liệu", onClick: onExportData }] : []}
    primaryAction={onAddEmployee ? { icon: "➕", label: isCollapsed ? "" : "Thêm nhân viên", onClick: onAddEmployee } : null}
    footerLeft={<span>Trực tuyến: <strong>{loading ? "--" : (stats.activeStaff || 0)}</strong></span>}
    footerRight={<span>Cần duyệt: <strong>{loading ? "--" : pendingLeaveCount} đơn nghỉ phép</strong></span>}
  />;
};

export default StaffHeader;
