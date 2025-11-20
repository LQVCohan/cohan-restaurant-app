import React, { useState, useEffect, useRef, useContext } from "react";
import SearchBox from "../SearchBox/SearchBox";
import {
  FiBell,
  FiChevronDown,
  FiUser,
  FiSettings,
  FiMoon,
  FiHelpCircle,
  FiCommand,
  FiLogOut,
  FiInfo,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";
import "./Styles/Header.scss";
import { AuthContext } from "@/context/AuthContext";
// Hàm-tiện-ích-để-lấy-icon-thông-báo
const getNotificationIcon = (type) => {
  switch (type) {
    case "success":
      return <FiCheckCircle />;
    case "warning":
      return <FiAlertTriangle />;
    case "primary":
      return <FiInfo />;
    case "info":
    default:
      return <FiBell />;
  }
};

const Header = ({
  pageTitle = "Tổng quan",
  onToggleSidebar,
  sidebarOpen = false,
  notifications = [], // Thêm-một-vài-thông-báo-mẫu-để-test
  // user = {
  //   name: "Nguyễn Quản Lý",
  //   roleName: "Quản lý cửa hàng",
  //   email: "manager@restaurant.com",
  //   avatar: "👨‍💼",
  // },
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Refs cho các container dropdown
  const notificationRef = useRef(null);
  const userMenuRef = useRef(null);
  const { user } = useContext(AuthContext);
  console.log("user: header ", user);
  const normalizeUser = {
    fullName: user.fullName,
    roleName: user.role.name,
    email: user.email,
    avatar: user.avatarIcon || "👨‍💼",
    status: user.status,
  };
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
      // Đóng-Notification-Dropdown
      if (
        notificationRef.current &&
        !notificationRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
      // Đóng-User-Menu-Dropdown
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []); // Thêm-dependency-array-rỗng

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
    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    setShowUserMenu(false); // Đóng-menu-kia-khi-mở-menu-này
  };

  const handleUserMenuClick = () => {
    setShowUserMenu(!showUserMenu);
    setShowNotifications(false); // Đóng-menu-kia-khi-mở-menu-này
  };

  const markAllAsRead = () => {
    console.log("Mark all notifications as read");
    // Thêm-logic-xử-lý-tại-đây
  };

  const handleLogout = () => {
    console.log("User logged out");
    // Thêm-logic-đăng-xuất-tại-đây
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
          <div className="notification-container" ref={notificationRef}>
            <button
              className={`notification-btn ${
                showNotifications ? "notification-btn--active" : ""
              }`}
              onClick={handleNotificationClick}
            >
              <FiBell /> {/* Icon-thay-thế */}
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
                  {notifications.length > 0 ? (
                    notifications.map((notification, index) => (
                      <div
                        key={index}
                        className={`notification-item ${
                          !notification.read ? "notification-item--unread" : ""
                        }`}
                      >
                        <div
                          className={`notification-icon notification-icon--${notification.type}`}
                        >
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="notification-content">
                          <h4>{notification.title}</h4>
                          <p>{notification.message}</p>
                          <span className="notification-time">
                            {notification.time}
                          </span>
                        </div>
                        {!notification.read && (
                          <div className="unread-dot"></div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="notification-empty">
                      <p>Không có thông báo mới</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <div className="user-menu-container" ref={userMenuRef}>
            <button
              className={`user-menu-btn ${
                showUserMenu ? "user-menu-btn--active" : ""
              }`}
              onClick={handleUserMenuClick}
            >
              <div className="user-avatar">
                {normalizeUser.avatar}
                <div className="user-status"></div>
              </div>
              <div
                className={`user-info ${
                  sidebarOpen ? "hide-compact" : "hide-mobile"
                }`}
              >
                <span className="user-name">{normalizeUser.fullName}</span>
                <span className="user-roleName">{normalizeUser.roleName}</span>
              </div>
              <span
                className={`user-chevron ${sidebarOpen ? "hide-compact" : ""}`}
              >
                <FiChevronDown /> {/* Icon-thay-thế */}
              </span>
            </button>

            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  <div className="user-avatar-large">{user.avatar}</div>
                  <div className="user-details">
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                    <span className="user-badge">{user.roleName}</span>
                  </div>
                </div>

                <div className="user-menu-items">
                  <button className="user-menu-item">
                    <span className="menu-icon">
                      <FiUser />
                    </span>
                    <span>Thông tin cá nhân</span>
                  </button>
                  <button className="user-menu-item">
                    <span className="menu-icon">
                      <FiSettings />
                    </span>
                    <span>Cài đặt tài khoản</span>
                  </button>
                  <button className="user-menu-item">
                    <span className="menu-icon">
                      <FiMoon />
                    </span>
                    <span>Chế độ tối</span>
                  </button>
                  <button className="user-menu-item">
                    <span className="menu-icon">
                      <FiBell />
                    </span>
                    <span>Cài đặt thông báo</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button className="user-menu-item">
                    <span className="menu-icon">
                      <FiHelpCircle />
                    </span>
                    <span>Trợ giúp & Hỗ trợ</span>
                  </button>
                  <button className="user-menu-item">
                    <span className="menu-icon">
                      <FiCommand />
                    </span>
                    <span>Phím tắt</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button
                    className="user-menu-item user-menu-item--danger"
                    onClick={handleLogout}
                  >
                    <span className="menu-icon">
                      <FiLogOut />
                    </span>
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
