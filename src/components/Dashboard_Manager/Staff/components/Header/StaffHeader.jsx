// src/pages/StaffManagement/components/StaffHeader.jsx
import React, { useMemo, useState, useEffect } from "react";
import "./StaffHeader.scss";

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
  isCollapsed, // Props từ cha
  onToggle, // Props từ cha
}) => {
  // --- TIME LOGIC ---
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // cập nhật mỗi 60s

    return () => clearInterval(timer);
  }, []); // chỉ chạy 1 lần khi mount -> tránh loop

  const getCurrentShift = (date) => {
    const hour = date.getHours();
    if (hour >= 6 && hour < 14) return { label: "Ca Sáng", icon: "🌅" };
    if (hour >= 14 && hour < 22) return { label: "Ca Chiều", icon: "☀️" };
    return { label: "Ca Đêm", icon: "🌙" };
  };

  const currentShift = getCurrentShift(currentTime);

  const dateStr = currentTime.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  const timeStr = currentTime.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // --- STATS DATA ---
  const statsData = useMemo(() => {
    const avgRate = Math.round((stats.avgRate || 0) * 10) / 10;
    const formattedAvgRate = Number.isFinite(avgRate)
      ? avgRate.toFixed(1)
      : "0.0";

    return [
      {
        id: "total",
        icon: "👥",
        label: "Tổng nhân sự",
        value: loading ? "--" : formatNumber(stats.totalStaff || 0),
        badge: "Toàn bộ",
        tone: "primary",
      },
      {
        id: "active",
        icon: "✅",
        label: "Đang làm việc",
        value: loading ? "--" : formatNumber(stats.activeStaff || 0),
        badge: "Online",
        tone: "success",
      },
      {
        id: "leave",
        icon: "☕",
        label: "Nghỉ phép",
        value: loading ? "--" : formatNumber(stats.onLeaveStaff || 0),
        badge: "Vắng",
        tone: "warning",
      },
      {
        id: "rate",
        icon: "⭐",
        label: "Đánh giá",
        value: loading ? "--" : `${formattedAvgRate} / 5`,
        badge: "Avg",
        tone: "info",
      },
    ];
  }, [stats, loading]);

  const activeAvatars = [
    { id: 1, img: "https://i.pravatar.cc/100?img=1", name: "Nam" },
    { id: 2, img: "https://i.pravatar.cc/100?img=5", name: "Hương" },
    { id: 3, img: "https://i.pravatar.cc/100?img=8", name: "Tuấn" },
    { id: 4, img: "https://i.pravatar.cc/100?img=12", name: "Linh" },
  ];

  // --- QUICK ACTIONS ---
  const quickActions = [
    {
      icon: "📝",
      label: "Điểm Danh",
      onClick: () => onPageChange("attendance"),
    },
    { icon: "📅", label: "Lịch Làm", onClick: () => onPageChange("schedule") },
    {
      icon: "💰",
      label: "Tính Lương",
      onClick: () => alert("💰 Tính năng demo"),
    },
    { icon: "🏖️", label: "Nghỉ Phép", onClick: () => onPageChange("leave") },
  ];

  return (
    <div className={`staff-header-card ${isCollapsed ? "collapsed" : ""}`}>
      {/* NÚT TOGGLE - Luôn nằm góc trên phải */}
      <button
        className="staff-header-toggle-btn"
        onClick={onToggle}
        title={isCollapsed ? "Mở rộng" : "Thu gọn"}
      >
        {isCollapsed ? "▼" : "▲"}
      </button>

      {/* CỘT TRÁI: SIDEBAR */}
      <div className="staff-header-sidebar">
        <div className="staff-sidebar-card">
          <div className="staff-title-block">
            <div className="staff-eyebrow">Bảng điều khiển</div>
            <h1>Quản Lý Nhân Sự</h1>
            <p className="staff-subtitle">
              Theo dõi nhân sự và cập nhật trạng thái theo thời gian thực.
            </p>
          </div>

          <div className="staff-time-widget">
            <div className="staff-time-row">
              <span className="staff-clock-time">{timeStr}</span>
              <span className="staff-shift-badge">
                {currentShift.icon} {currentShift.label}
              </span>
            </div>
            <div className="staff-date-row">{dateStr}</div>
          </div>
        </div>

        <div className="staff-controls-card">
          <div className="staff-tools-row">
            <label className="staff-field">
              <span className="staff-field-label">Tìm kiếm</span>
              <div className="staff-search-box">
                <span className="staff-search-icon">🔍</span>
                <input type="text" placeholder="Tên nhân viên, vị trí..." />
              </div>
            </label>
            <label className="staff-field">
              <span className="staff-field-label">Chi nhánh</span>
              <div className="staff-branch-select-wrapper">
                <select
                  className="staff-restaurant-selector"
                  value={selectedRestaurant}
                  onChange={(e) => onRestaurantChange(e.target.value)}
                  title="Lọc theo chi nhánh"
                >
                  <option value="all">🏢 Toàn hệ thống</option>
                  {restaurantList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <span className="staff-select-arrow">▼</span>
              </div>
            </label>
          </div>

          <div className="staff-action-group">
            <button className="staff-btn staff-btn-ghost" onClick={onExportData}>
              📥 Xuất File
            </button>
            <button className="staff-btn staff-btn-primary" onClick={onAddEmployee}>
              ➕ Thêm Mới
            </button>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: CONTENT AREA */}
      <div className="staff-header-content">
        <div className="staff-mini-stats-grid">
          {statsData.map((item) => (
            <div
              key={item.id}
              className={`staff-mini-stat-item staff-tone-${item.tone}`}
            >
              <div className="staff-stat-icon-box">{item.icon}</div>
              <div className="staff-stat-info">
                <div className="staff-stat-value">{item.value}</div>
                <div className="staff-stat-label">{item.label}</div>
              </div>
              <div className="staff-stat-badge">{item.badge}</div>
            </div>
          ))}
        </div>

        <div className="staff-quick-actions-segment">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="staff-quick-action-btn"
              onClick={action.onClick}
            >
              <span className="staff-action-icon">{action.icon}</span>
              <span className="staff-action-label">{action.label}</span>
            </button>
          ))}
        </div>

        <div className="staff-quick-info-bar">
          <div className="staff-info-group">
            <span className="staff-label-text">Đang trực:</span>
            <div className="staff-avatar-stack">
              {activeAvatars.map((user) => (
                <img
                  key={user.id}
                  src={user.img}
                  alt={user.name}
                  className="staff-avatar-img"
                />
              ))}
              <div className="staff-avatar-more">
                +{stats.activeStaff > 4 ? stats.activeStaff - 4 : 0}
              </div>
            </div>
          </div>
          <div className="staff-divider-vertical"></div>
          <div className="staff-info-group">
            <span className="staff-label-text">Cần xử lý:</span>
            <div className="staff-pending-tags">
              <span className="staff-tag staff-tag-warn">📝 2 Đơn nghỉ</span>
              <span className="staff-tag staff-tag-info">🔄 1 Đổi ca</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffHeader;
