import React, { useState, useEffect } from "react";
import SearchBox from "../SearchBox/SearchBox";
import "./Styles/Header.scss";
const Header = ({
  pageTitle = "Tổng quan",
  onToggleSidebar,
  sidebarOpen = false,
  notifications = [],
  user = {
    name: "Nguyễn Quản Lý",
    role: "Quản lý cửa hàng",
    email: "manager@restaurant.com",
    avatar: "👨‍💼",
  },
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".notification-container")) {
        setShowNotifications(false);
      }
      if (!event.target.closest(".user-menu-container")) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggleSidebar = () => {
    console.log("Toggle clicked! Current state:", sidebarOpen);
    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    setShowUserMenu(false);
  };

  const handleUserMenuClick = () => {
    setShowUserMenu(!showUserMenu);
    setShowNotifications(false);
  };

  const markAllAsRead = () => {
    console.log("Mark all notifications as read");
  };

  return (
    <header className={`header ${sidebarOpen ? "header--compact" : ""}`}>
      <div className="header__content">
        {/* Left Section */}
        <div className="header__left">
          <button
            className={`sidebar-toggle ${sidebarOpen ? "active" : ""}`}
            onClick={handleToggleSidebar}
            title="Toggle Sidebar"
            type="button"
          >
            <div className="hamburger">
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </div>
          </button>

          <div className="page-info">
            <h1 className="page-title">{pageTitle}</h1>
            <span
              className={`page-subtitle ${
                sidebarOpen ? "hide-compact" : "hide-mobile"
              }`}
            >
              {formatDate(currentTime)}
            </span>
          </div>
        </div>

        {/* Center Section - Search */}
        <div
          className={`header__center ${
            sidebarOpen ? "header__center--compact" : ""
          }`}
        >
          <SearchBox />
        </div>

        {/* Right Section */}
        <div className="header__right">
          {/* Time Display */}
          <div className="time-display hide-mobile">
            <div className="current-time">{formatTime(currentTime)}</div>
            <div className="current-status">
              <span className="status-dot"></span>
              Đang hoạt động
            </div>
          </div>

          {/* Notifications */}
          <div className="notification-container">
            <button
              className={`notification-btn ${
                showNotifications ? "notification-btn--active" : ""
              }`}
              onClick={handleNotificationClick}
            >
              🔔
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <h3>Thông báo</h3>
                  <button className="mark-all-read" onClick={markAllAsRead}>
                    Đánh dấu đã đọc
                  </button>
                </div>
                <div className="notification-list">
                  {notifications.map((notification, index) => (
                    <div
                      key={index}
                      className={`notification-item ${
                        !notification.read ? "notification-item--unread" : ""
                      }`}
                    >
                      <div
                        className={`notification-icon notification-icon--${notification.type}`}
                      >
                        {notification.icon}
                      </div>
                      <div className="notification-content">
                        <h4>{notification.title}</h4>
                        <p>{notification.message}</p>
                        <span className="notification-time">
                          {notification.time}
                        </span>
                      </div>
                      {!notification.read && <div className="unread-dot"></div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="user-menu-container">
            <button
              className={`user-menu-btn ${
                showUserMenu ? "user-menu-btn--active" : ""
              }`}
              onClick={handleUserMenuClick}
            >
              <div className="user-avatar">
                {user.avatar}
                <div className="user-status"></div>
              </div>
              <div
                className={`user-info ${
                  sidebarOpen ? "hide-compact" : "hide-mobile"
                }`}
              >
                <span className="user-name">{user.name}</span>
                <span className="user-role">{user.role}</span>
              </div>
              <span
                className={`user-chevron ${sidebarOpen ? "hide-compact" : ""}`}
              >
                ▼
              </span>
            </button>

            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="user-avatar-large">{user.avatar}</div>
                  <div className="user-details">
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                    <span className="user-badge">Quản lý</span>
                  </div>
                </div>

                <div className="user-menu-items">
                  <button className="user-menu-item">
                    <span className="menu-icon">👤</span>
                    <span>Thông tin cá nhân</span>
                  </button>
                  <button className="user-menu-item">
                    <span className="menu-icon">⚙️</span>
                    <span>Cài đặt tài khoản</span>
                  </button>
                  <button className="user-menu-item">
                    <span className="menu-icon">🌙</span>
                    <span>Chế độ tối</span>
                  </button>
                  <button className="user-menu-item">
                    <span className="menu-icon">🔔</span>
                    <span>Cài đặt thông báo</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button className="user-menu-item">
                    <span className="menu-icon">❓</span>
                    <span>Trợ giúp & Hỗ trợ</span>
                  </button>
                  <button className="user-menu-item">
                    <span className="menu-icon">⌨️</span>
                    <span>Phím tắt</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button className="user-menu-item user-menu-item--danger">
                    <span className="menu-icon">🚪</span>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
