import React, { useMemo, useState, useEffect } from "react";
import "./StaffHeader.scss";

// Utility formatting
const formatNumber = (value) =>
  typeof value === "number" ? value.toLocaleString("vi-VN") : value;

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
}) => {
  // --- TIME & GREETING LOGIC ---
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const getShiftInfo = (date) => {
    const h = date.getHours();
    if (h >= 5 && h < 12)
      return { label: "Ca Sáng", icon: "🌅", greeting: "Chào buổi sáng" };
    if (h >= 12 && h < 18)
      return { label: "Ca Chiều", icon: "☀️", greeting: "Chào buổi chiều" };
    return { label: "Ca Tối", icon: "🌙", greeting: "Buổi tối tốt lành" };
  };

  const shiftInfo = getShiftInfo(currentTime);
  const timeStr = currentTime.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = currentTime.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  // --- STATS DATA ---
  const statsData = useMemo(() => {
    const avgRate = Math.round((stats.avgRate || 0) * 10) / 10;
    return [
      {
        id: "total",
        icon: "👥",
        label: "Tổng nhân sự",
        value: stats.totalStaff || 0,
        tone: "primary",
        trend: "+2",
      },
      {
        id: "active",
        icon: "🟢",
        label: "Đang làm việc",
        value: stats.activeStaff || 0,
        tone: "success",
        suffix: "Online",
      },
      {
        id: "leave",
        icon: "📅",
        label: "Nghỉ phép",
        value: stats.onLeaveStaff || 0,
        tone: "warning",
        suffix: "Hôm nay",
      },
      {
        id: "rate",
        icon: "⭐",
        label: "Đánh giá TB",
        value: avgRate ? avgRate.toFixed(1) : "0.0",
        tone: "info",
        suffix: "/ 5.0",
      },
    ];
  }, [stats]);

  const activeAvatars = [
    { id: 1, img: "https://i.pravatar.cc/100?img=11" },
    { id: 2, img: "https://i.pravatar.cc/100?img=5" },
    { id: 3, img: "https://i.pravatar.cc/100?img=8" },
  ];

  const quickActions = [
    {
      icon: "📝",
      label: "Điểm Danh",
      onClick: () => onPageChange("attendance"),
    },
    { icon: "📅", label: "Xếp Ca", onClick: () => onPageChange("schedule") },
    { icon: "🏖️", label: "Nghỉ Phép", onClick: () => onPageChange("leave") },
  ];

  return (
    <div className={`premium-staff-header ${isCollapsed ? "collapsed" : ""}`}>
      {/* BACKGROUND DECORATION */}
      <div className="header-decor-circle"></div>

      {/* TOGGLE BUTTON */}
      <button
        className="header-toggle-btn"
        onClick={onToggle}
        title="Thu gọn/Mở rộng"
      >
        <span className="toggle-icon">{isCollapsed ? "▼" : "▲"}</span>
      </button>

      {/* --- LEFT COLUMN: IDENTITY & CONTEXT --- */}
      <div className="header-column col-identity">
        <div className="identity-content">
          <div className="brand-tag">HR Manager</div>
          <h1 className="page-title">
            {isCollapsed ? "Nhân Sự" : "Quản Lý Nhân Sự"}
          </h1>

          {!isCollapsed && (
            <>
              <div className="greeting-block">
                <span className="greeting-text">
                  {shiftInfo.greeting}, Admin!
                </span>
                <p className="sub-text">
                  Theo dõi hoạt động nhân sự theo thời gian thực.
                </p>
              </div>

              <div className="time-widget-card">
                <div className="time-display">
                  <span className="clock">{timeStr}</span>
                  <span className="date">{dateStr}</span>
                </div>
                <div className="shift-badge">
                  {shiftInfo.icon} <span>{shiftInfo.label}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* --- RIGHT COLUMN: METRICS & TOOLS --- */}
      <div className="header-column col-workspace">
        {/* TOP ROW: STATS GRID */}
        {!isCollapsed && (
          <div className="stats-grid-row">
            {statsData.map((item) => (
              <div key={item.id} className={`stat-card tone-${item.tone}`}>
                <div className="stat-icon-wrapper">{item.icon}</div>
                <div className="stat-content">
                  <span className="stat-label">{item.label}</span>
                  <div className="stat-value-group">
                    <span className="stat-value">
                      {loading ? "--" : formatNumber(item.value)}
                    </span>
                    {item.suffix && (
                      <span className="stat-suffix">{item.suffix}</span>
                    )}
                    {item.trend && (
                      <span className="stat-trend success">↗ {item.trend}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* BOTTOM ROW: TOOLBAR (SEARCH, FILTER, ACTIONS) */}
        <div className="toolbar-row">
          <div className="search-filter-group">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder={
                  isCollapsed ? "Tìm kiếm..." : "Tìm tên nhân viên, mã số..."
                }
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
              />
            </div>

            <div className="branch-select-wrapper">
              <select
                className="custom-select"
                value={selectedRestaurant}
                onChange={(e) => onRestaurantChange(e.target.value)}
              >
                <option value="all">🏢 Toàn hệ thống</option>
                {restaurantList.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="actions-group">
            {!isCollapsed && (
              <div className="quick-nav">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    className="quick-btn"
                    onClick={action.onClick}
                    title={action.label}
                  >
                    {action.icon}
                  </button>
                ))}
              </div>
            )}

            <div className="divider-vertical"></div>

            <button className="btn btn-secondary" onClick={onExportData}>
              <span>📤 Export</span>
            </button>
            <button className="btn btn-primary" onClick={onAddEmployee}>
              <span>➕ {isCollapsed ? "" : "Thêm Nhân Sự"}</span>
            </button>
          </div>
        </div>

        {/* INFO FOOTER (Only shown when expanded) */}
        {!isCollapsed && (
          <div className="info-footer-row">
            <div className="active-users-stack">
              <span className="footer-label">Đang trực tuyến:</span>
              <div className="avatar-group">
                {activeAvatars.map((u) => (
                  <img key={u.id} src={u.img} alt="User" className="avatar" />
                ))}
                <div className="avatar-counter">
                  +{stats.activeStaff > 3 ? stats.activeStaff - 3 : 0}
                </div>
              </div>
            </div>

            <div className="pending-tasks">
              <span className="footer-label">Cần duyệt:</span>
              <span className="task-badge warn">2 Nghỉ phép</span>
              <span className="task-badge info">1 Ứng lương</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffHeader;
