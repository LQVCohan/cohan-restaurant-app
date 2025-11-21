// src/pages/StaffManagement/components/Header.jsx
import React, { useMemo, useState, useEffect } from "react";
import "./Header.scss";

const formatNumber = (value) =>
  typeof value === "number" ? value.toLocaleString("vi-VN") : value;

const Header = ({
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
    <div className={`header-card ${isCollapsed ? "collapsed" : ""}`}>
      {/* NÚT TOGGLE - Luôn nằm góc trên phải */}
      <button
        className="header-toggle-btn"
        onClick={onToggle}
        title={isCollapsed ? "Mở rộng" : "Thu gọn"}
      >
        {isCollapsed ? "▼" : "▲"}
      </button>

      {/* CỘT TRÁI: SIDEBAR */}
      <div className="header-sidebar">
        <div className="sidebar-top">
          <div className="title-block">
            <div className="eyebrow">Bảng điều khiển</div>
            <h1>Quản Lý Nhân Sự</h1>
          </div>

          <div className="time-widget">
            <div className="time-row">
              <span className="clock-time">{timeStr}</span>
              <span className="shift-badge">
                {currentShift.icon} {currentShift.label}
              </span>
            </div>
            <div className="date-row">{dateStr}</div>
          </div>
        </div>

        <div className="sidebar-controls">
          <div className="tools-row">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Tìm nhanh..." />
            </div>
            <div className="branch-select-wrapper">
              <select
                className="restaurant-selector"
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
              <span className="select-arrow">▼</span>
            </div>
          </div>

          <div className="action-group">
            <button className="btn btn-ghost" onClick={onExportData}>
              📥 Xuất File
            </button>
            <button className="btn btn-primary" onClick={onAddEmployee}>
              ➕ Thêm Mới
            </button>
          </div>
        </div>
      </div>

      {/* CỘT PHẢI: CONTENT AREA */}
      <div className="header-content">
        <div className="mini-stats-grid">
          {statsData.map((item) => (
            <div key={item.id} className={`mini-stat-item tone-${item.tone}`}>
              <div className="stat-icon-box">{item.icon}</div>
              <div className="stat-info">
                <div className="stat-value">{item.value}</div>
                <div className="stat-label">{item.label}</div>
              </div>
              <div className="stat-badge">{item.badge}</div>
            </div>
          ))}
        </div>

        <div className="quick-actions-segment">
          {quickActions.map((action, index) => (
            <button
              key={index}
              className="quick-action-btn"
              onClick={action.onClick}
            >
              <span className="action-icon">{action.icon}</span>
              <span className="action-label">{action.label}</span>
            </button>
          ))}
        </div>

        <div className="quick-info-bar">
          <div className="info-group">
            <span className="label-text">Đang trực:</span>
            <div className="avatar-stack">
              {activeAvatars.map((user) => (
                <img
                  key={user.id}
                  src={user.img}
                  alt={user.name}
                  className="avatar-img"
                />
              ))}
              <div className="avatar-more">
                +{stats.activeStaff > 4 ? stats.activeStaff - 4 : 0}
              </div>
            </div>
          </div>
          <div className="divider-vertical"></div>
          <div className="info-group">
            <span className="label-text">Cần xử lý:</span>
            <div className="pending-tags">
              <span className="tag warn">📝 2 Đơn nghỉ</span>
              <span className="tag info">🔄 1 Đổi ca</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
