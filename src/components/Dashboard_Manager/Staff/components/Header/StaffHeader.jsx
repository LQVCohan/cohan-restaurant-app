import React, { useEffect, useMemo, useState } from "react";
import ManagementPageHeader from "../../../shared/ManagementPageHeader";
import "./StaffHeader.scss";
import "./StaffHeaderContextPolish.scss";

const STAFF_PAGE_COPY = {
  dashboard: {
    eyebrow: "TRUNG TÂM NHÂN SỰ",
    title: "Quản lý nhân sự",
    compactTitle: "Nhân sự",
    subtitle:
      "Theo dõi hồ sơ, trạng thái làm việc, chấm công và phân công nhân viên theo từng nhà hàng.",
  },
  attendance: {
    eyebrow: "NHÂN SỰ · CHẤM CÔNG",
    title: "Chấm công nhân viên",
    compactTitle: "Chấm công",
    subtitle:
      "Kiểm tra vào ca, tan ca, chỉnh công và tăng ca trong ngày đang chọn.",
  },
  leave: {
    eyebrow: "NHÂN SỰ · NGHỈ PHÉP",
    title: "Nghỉ phép nhân viên",
    compactTitle: "Nghỉ phép",
    subtitle:
      "Theo dõi đơn nghỉ phép, trạng thái duyệt và số hồ sơ cần xử lý.",
  },
  schedule: {
    eyebrow: "NHÂN SỰ · LỊCH LÀM",
    title: "Lịch làm nhân viên",
    compactTitle: "Lịch làm",
    subtitle:
      "Lập lịch, kiểm tra ca và rà soát lịch theo từng nhà hàng.",
  },
  performance: {
    eyebrow: "NHÂN SỰ · HIỆU SUẤT",
    title: "Hiệu suất nhân viên",
    compactTitle: "Hiệu suất",
    subtitle:
      "Theo dõi điểm hiệu suất, phản hồi và các dữ liệu ảnh hưởng đến đánh giá.",
  },
  reports: {
    eyebrow: "NHÂN SỰ · BÁO CÁO",
    title: "Báo cáo nhân sự",
    compactTitle: "Báo cáo",
    subtitle:
      "Tổng hợp dữ liệu nhân sự, chấm công, lịch làm và kết quả vận hành.",
  },
};

const getStaffPageFromLocation = () => {
  if (typeof window === "undefined") return "dashboard";
  const params = new URLSearchParams(window.location.search || "");
  const staffPage = params.get("staffPage");
  return STAFF_PAGE_COPY[staffPage] ? staffPage : "dashboard";
};

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
  const [activeStaffPage, setActiveStaffPage] = useState(getStaffPageFromLocation);

  useEffect(() => {
    const syncFromQuery = (event) => {
      const eventPage = event?.detail?.page;
      const nextPage =
        event?.detail?.query?.staffPage ||
        (eventPage && eventPage !== "staff" ? eventPage : "") ||
        getStaffPageFromLocation();
      if (STAFF_PAGE_COPY[nextPage]) setActiveStaffPage(nextPage);
    };

    window.addEventListener("staff:page-change", syncFromQuery);
    window.addEventListener("manager:navigation-query", syncFromQuery);
    window.addEventListener("popstate", syncFromQuery);
    window.addEventListener("hashchange", syncFromQuery);

    return () => {
      window.removeEventListener("staff:page-change", syncFromQuery);
      window.removeEventListener("manager:navigation-query", syncFromQuery);
      window.removeEventListener("popstate", syncFromQuery);
      window.removeEventListener("hashchange", syncFromQuery);
    };
  }, []);

  const statsData = useMemo(() => {
    const parsedAverageRate = Number(stats.avgRate);
    const hasAverageRate =
      Number.isFinite(parsedAverageRate) &&
      (stats.avgRateAvailable === true || parsedAverageRate > 0);

    return [
      { id: "total", icon: "👥", label: "Tổng nhân viên", value: stats.totalStaff || 0 },
      { id: "active", icon: "🟢", label: "Đang trực tuyến", value: stats.activeStaff || 0, suffix: "nhân viên" },
      { id: "leave", icon: "📅", label: "Đang nghỉ phép", value: stats.onLeaveStaff || 0, suffix: "hồ sơ" },
      {
        id: "rate",
        icon: "⭐",
        label: "Hiệu suất TB",
        value: hasAverageRate
          ? (Math.round(parsedAverageRate * 10) / 10).toFixed(1)
          : "—",
        suffix: hasAverageRate ? "/5.0" : "chưa có dữ liệu",
      },
    ];
  }, [stats]);

  const pageStatsData = useMemo(() => {
    const base = {
      total: { id: "total", icon: "👥", label: "Nhân sự", value: stats.totalStaff || 0 },
      active: { id: "active", icon: "🟢", label: "Trực tuyến", value: stats.activeStaff || 0 },
      onLeave: { id: "leave", icon: "🏖️", label: "Đang nghỉ", value: stats.onLeaveStaff || 0 },
      pending: { id: "pending", icon: "📝", label: "Đơn chờ duyệt", value: pendingLeaveCount || 0 },
    };

    if (activeStaffPage === "attendance") {
      return [
        base.total,
        base.active,
        { id: "need-check", icon: "⚡", label: "Thao tác nhanh", value: "Vào/Tan" },
        base.pending,
      ];
    }
    if (activeStaffPage === "leave") {
      return [base.pending, base.onLeave, base.total, base.active];
    }
    if (activeStaffPage === "schedule") {
      return [
        base.total,
        { id: "calendar", icon: "🗓️", label: "Lập lịch", value: "Theo tuần" },
        base.onLeave,
        base.pending,
      ];
    }
    if (activeStaffPage === "performance") {
      return [
        base.total,
        statsData.find((item) => item.id === "rate"),
        base.active,
        base.pending,
      ].filter(Boolean);
    }
    if (activeStaffPage === "reports") {
      return [
        { id: "range", icon: "📊", label: "Báo cáo", value: "Theo kỳ" },
        base.total,
        base.active,
        base.pending,
      ];
    }
    return statsData;
  }, [activeStaffPage, pendingLeaveCount, stats.activeStaff, stats.onLeaveStaff, stats.totalStaff, statsData]);

  const pageQuickActions = useMemo(() => {
    if (activeStaffPage === "dashboard") {
      return [
        { icon: "📝", label: "Chấm công", title: "Điểm danh và theo dõi chấm công", onClick: () => goToStaffPage("attendance") },
        { icon: "📅", label: "Xếp ca", title: "Xếp ca làm việc", onClick: () => goToStaffPage("schedule") },
        { icon: "🏖️", label: "Nghỉ phép", title: "Duyệt và theo dõi nghỉ phép", onClick: () => goToStaffPage("leave") },
      ];
    }
    const shortcuts = {
      attendance: [
        { icon: "🏖️", label: "Nghỉ phép", title: "Mở nghỉ phép", onClick: () => goToStaffPage("leave") },
        { icon: "📅", label: "Lịch", title: "Mở lịch làm", onClick: () => goToStaffPage("schedule") },
      ],
      leave: [
        { icon: "✅", label: "Chấm công", title: "Mở chấm công", onClick: () => goToStaffPage("attendance") },
        { icon: "📅", label: "Lịch", title: "Mở lịch làm", onClick: () => goToStaffPage("schedule") },
      ],
      schedule: [
        { icon: "✅", label: "Chấm công", title: "Mở chấm công", onClick: () => goToStaffPage("attendance") },
        { icon: "📈", label: "Hiệu suất", title: "Mở hiệu suất", onClick: () => goToStaffPage("performance") },
      ],
      performance: [
        { icon: "📊", label: "Báo cáo", title: "Mở báo cáo", onClick: () => goToStaffPage("reports") },
        { icon: "✅", label: "Chấm công", title: "Mở chấm công", onClick: () => goToStaffPage("attendance") },
      ],
      reports: [
        { icon: "📈", label: "Hiệu suất", title: "Mở hiệu suất", onClick: () => goToStaffPage("performance") },
        { icon: "✅", label: "Chấm công", title: "Mở chấm công", onClick: () => goToStaffPage("attendance") },
      ],
    };
    return shortcuts[activeStaffPage] || [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStaffPage]);

  const isOverviewPage = activeStaffPage === "dashboard";
  const pageCopy = STAFF_PAGE_COPY[activeStaffPage] || STAFF_PAGE_COPY.dashboard;

  function goToStaffPage(page) {
    setActiveStaffPage(page);
    window.dispatchEvent(
      new CustomEvent("staff:page-change", { detail: { page, source: "staff-header" } }),
    );
    onPageChange?.(page);
  }

  return <ManagementPageHeader
    className={`staff-page-header ${isOverviewPage ? "" : "is-subpage-context"}`.trim()}
    density="compact"
    statsPlacement={pageStatsData.length ? "right" : "none"}
    eyebrow={pageCopy.eyebrow}
    title={isCollapsed ? pageCopy.compactTitle : pageCopy.title}
    subtitle={pageCopy.subtitle}
    stats={pageStatsData}
    loading={loading}
    isCollapsed={isCollapsed}
    onToggle={onToggle}
    searchValue={searchValue}
    onSearchChange={onSearchChange}
    searchPlaceholder={isCollapsed ? "Tìm nhân viên..." : "Tìm tên, mã nhân viên, SĐT..."}
    selectedRestaurant={selectedRestaurant}
    onRestaurantChange={onRestaurantChange}
    restaurantList={restaurantList}
    quickActions={pageQuickActions}
    secondaryActions={onExportData && isOverviewPage ? [{ icon: "📤", label: "Xuất dữ liệu", onClick: onExportData }] : []}
    primaryAction={onAddEmployee ? { icon: "➕", label: isCollapsed ? "" : "Thêm nhân viên", onClick: onAddEmployee } : null}
    footerLeft={isOverviewPage ? <span>Trực tuyến: <strong>{loading ? "--" : (stats.activeStaff || 0)}</strong></span> : <span>Trang hiện tại: <strong>{pageCopy.compactTitle}</strong></span>}
    footerRight={isOverviewPage ? <span>Cần duyệt: <strong>{loading ? "--" : pendingLeaveCount} đơn nghỉ phép</strong></span> : <span>Cần duyệt: <strong>{loading ? "--" : pendingLeaveCount} đơn</strong></span>}
  />;
};

export default StaffHeader;
