import React, { useState, useEffect, useRef, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import SearchBox from "../SearchBox/SearchBox";
import {
  FiBell,
  FiChevronDown,
  FiUser,
  FiSettings,
  FiMoon,
  FiHelpCircle,
  FiLogOut,
  FiInfo,
  FiCheckCircle,
  FiAlertTriangle,
} from "react-icons/fi";
import "./Styles/Header.scss";
import "./Styles/HeaderShellFix.scss";
import { AuthContext } from "@/context/AuthContext";
import { getDisplayUser, getInitials, resolveUserAvatarSrc } from "@/lib/userAvatar";
import { getBrandRoleLabel, getCombinedRoleLabel, getMembershipScopeLabel, getRoleTooltip, getSystemRoleLabel } from "@/lib/userRoleDisplay";

const getNotificationIcon = (type) => {
  switch (type) {
    case "success": return <FiCheckCircle />;
    case "warning": return <FiAlertTriangle />;
    case "primary": return <FiInfo />;
    case "info":
    default: return <FiBell />;
  }
};

const Header = ({
  pageTitle = "Tổng quan",
  onToggleSidebar,
  sidebarOpen = false,
  notifications = [],
  searchItems = [],
  scopeSelector = null,
  onSelectSearchResult,
  onNotificationSelect,
  onMarkAllNotificationsRead,
  activeBrand = null,
}) => {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [localNotifications, setLocalNotifications] = useState(notifications);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("manager.darkMode") === "1";
  });

  const notificationRef = useRef(null);
  const userMenuRef = useRef(null);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    setLocalNotifications(Array.isArray(notifications) ? notifications : []);
  }, [notifications]);

  useEffect(() => {
    document.body.classList.toggle("manager-dark-mode", isDarkMode);
    localStorage.setItem("manager.darkMode", isDarkMode ? "1" : "0");
  }, [isDarkMode]);

  const normalizeUser = useMemo(() => getDisplayUser(user), [user]);
  const systemRoleLabel = useMemo(() => getSystemRoleLabel(user), [user]);
  const brandRoleLabel = useMemo(() => getBrandRoleLabel({ user, activeBrand }), [activeBrand, user]);
  const activeMembership = activeBrand?.membership || (activeBrand?.membershipRole ? { role: activeBrand.membershipRole, restaurantIds: activeBrand.restaurantIds || [] } : null);
  const scopeLabel = useMemo(() => getMembershipScopeLabel(activeMembership || { role: activeBrand?.membershipRole }, activeBrand?.restaurants, activeBrand?.name), [activeBrand, activeMembership]);
  const roleLine = useMemo(() => getCombinedRoleLabel({ user, activeBrand, membership: activeMembership }), [activeBrand, activeMembership, user]);
  const roleTooltip = useMemo(() => getRoleTooltip({ user, activeBrand, membership: activeMembership }), [activeBrand, activeMembership, user]);
  const avatarSrc = useMemo(() => resolveUserAvatarSrc(normalizeUser), [normalizeUser]);

  const avatarFallback = useMemo(() => getInitials(normalizeUser.fullName), [normalizeUser.fullName]);

  useEffect(() => {
    setAvatarImageFailed(false);
  }, [avatarSrc]);

  const renderUserAvatar = (className, showStatus = false) => (
    <div className={className}>
      {avatarSrc && !avatarImageFailed ? (
        <img src={avatarSrc} alt={normalizeUser.fullName} onError={() => setAvatarImageFailed(true)} />
      ) : (
        <span className="user-avatar-initials" aria-hidden="true">{avatarFallback}</span>
      )}
      {showStatus ? <div className="user-status"></div> : null}
    </div>
  );

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatTime = (date) => date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = (date) => date.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const unreadCount = localNotifications.filter((n) => !n.read).length;

  const handleToggleSidebar = () => onToggleSidebar?.();
  const handleNotificationClick = () => { setShowNotifications((prev) => !prev); setShowUserMenu(false); };
  const handleUserMenuClick = () => { setShowUserMenu((prev) => !prev); setShowNotifications(false); };

  const navigateToActionUrl = (actionUrl) => {
    if (!actionUrl) return;
    if (actionUrl.startsWith("/manager") && typeof window !== "undefined") {
      const url = new URL(actionUrl, window.location.origin);
      const page = url.hash?.replace("#", "") || "dashboard";
      const query = Object.fromEntries(url.searchParams.entries());
      window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page, query, source: "notification" } }));
      return;
    }
    navigate(actionUrl);
  };

  const markAllAsRead = () => {
    setLocalNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    onMarkAllNotificationsRead?.();
  };

  const handleNotificationItemClick = (notification) => {
    if (!notification) return;
    setLocalNotifications((prev) => prev.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    onNotificationSelect?.(notification);
    navigateToActionUrl(notification.actionUrl);
    setShowNotifications(false);
  };

  const handleNotificationItemKeyDown = (event, notification) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleNotificationItemClick(notification);
  };

  const handleLogout = () => {
    logout?.();
    setShowUserMenu(false);
  };

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);
  const goToManagerPage = (hash) => { window.location.hash = hash; setShowUserMenu(false); setShowNotifications(false); };
  const goToSupport = () => { navigate("/contact"); setShowUserMenu(false); };

  return (
    <header className={`header ${sidebarOpen ? "header--compact" : ""}`}>
      <div className="header__content">
        <div className="header__left">
          <button
            className={`sidebar-toggle ${sidebarOpen ? "active" : ""}`}
            onClick={handleToggleSidebar}
            title="Mở/đóng thanh điều hướng"
            type="button"
            aria-label={sidebarOpen ? "Thu gọn sidebar" : "Mở rộng sidebar"}
            aria-expanded={sidebarOpen}
          >
            <div className="hamburger">
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
              <span className="hamburger-line"></span>
            </div>
          </button>

          <div className="page-info">
            <h1 className="page-title">{pageTitle}</h1>
            <span className={`page-subtitle ${sidebarOpen ? "hide-compact" : "hide-mobile"}`}>{formatDate(currentTime)}</span>
          </div>
        </div>

        <div className={`header__center ${sidebarOpen ? "header__center--compact" : ""}`}>
          <SearchBox items={searchItems} onSelectItem={onSelectSearchResult} placeholder="Tìm kiếm trang quản lý..." />
        </div>

        {scopeSelector ? <div className="header__scope">{scopeSelector}</div> : null}

        <div className="header__right">
          <div className="time-display hide-mobile">
            <div className="current-time">{formatTime(currentTime)}</div>
            <div className="current-status"><span className="status-dot"></span>Đang hoạt động</div>
          </div>

          <div className="notification-container" ref={notificationRef}>
            <button
              className={`notification-btn ${showNotifications ? "notification-btn--active" : ""}`}
              onClick={handleNotificationClick}
              type="button"
              aria-label={unreadCount > 0 ? `Mở thông báo, ${unreadCount} chưa đọc` : "Mở thông báo"}
              aria-expanded={showNotifications}
            >
              <FiBell />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
            </button>

            {showNotifications && (
              <div className="notification-dropdown">
                <div className="notification-header">
                  <h3>Thông báo</h3>
                  <button className="mark-all-read" onClick={markAllAsRead} type="button">Đánh dấu đã đọc</button>
                </div>
                <div className="notification-list">
                  {localNotifications.length > 0 ? (
                    localNotifications.map((notification, index) => (
                      <div
                        key={notification.id || index}
                        role="button"
                        tabIndex={0}
                        className={`notification-item ${!notification.read ? "notification-item--unread" : ""}`}
                        onClick={() => handleNotificationItemClick(notification)}
                        onKeyDown={(event) => handleNotificationItemKeyDown(event, notification)}
                      >
                        <div className={`notification-icon notification-icon--${notification.type}`}>{getNotificationIcon(notification.type)}</div>
                        <div className="notification-content">
                          <h4>{notification.title}</h4>
                          <p>{notification.message}</p>
                          <span className="notification-time">{notification.time}</span>
                        </div>
                        {!notification.read && <div className="unread-dot"></div>}
                      </div>
                    ))
                  ) : (
                    <div className="notification-empty"><p>Không có thông báo mới</p></div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="user-menu-container" ref={userMenuRef}>
            <button
              className={`user-menu-btn ${showUserMenu ? "user-menu-btn--active" : ""}`}
              onClick={handleUserMenuClick}
              type="button"
              aria-label="Mở menu tài khoản"
              aria-expanded={showUserMenu}
              title={roleTooltip}
            >
              {renderUserAvatar("user-avatar", true)}
              <div className={`user-info ${sidebarOpen ? "hide-compact" : "hide-mobile"}`}>
                <span className="user-name">{normalizeUser.fullName}</span>
                <span className="user-roleName">{roleLine}</span>
              </div>
              <span className={`user-chevron ${sidebarOpen ? "hide-compact" : ""}`}><FiChevronDown /></span>
            </button>

            {showUserMenu && (
              <div className="user-dropdown">
                <div className="user-dropdown-header">
                  {renderUserAvatar("user-avatar-large")}
                  <div className="user-details">
                    <h3>{normalizeUser.fullName}</h3>
                    <p>{normalizeUser.email}</p>
                    <span className="user-badge">{brandRoleLabel || systemRoleLabel}</span>
                  </div>
                  <div className="user-role-breakdown" title={roleTooltip}>
                    <span>Loại tài khoản: <strong>{systemRoleLabel}</strong></span>
                    <span>Vai trò trong thương hiệu: <strong>{brandRoleLabel || "Chưa gắn Brand hiện tại"}</strong></span>
                    <span>Phạm vi phụ trách: <strong>{scopeLabel}</strong></span>
                  </div>
                </div>

                <div className="user-menu-items">
                  <button className="user-menu-item" type="button" onClick={() => goToManagerPage("restaurant-info-management")}>
                    <span className="menu-icon"><FiUser /></span><span>Thông tin cá nhân</span>
                  </button>
                  <button className="user-menu-item" type="button" onClick={() => goToManagerPage("restaurant-info-management")}>
                    <span className="menu-icon"><FiSettings /></span><span>Cài đặt tài khoản</span>
                  </button>
                  <button className="user-menu-item" onClick={toggleDarkMode} type="button">
                    <span className="menu-icon"><FiMoon /></span><span>{isDarkMode ? "Chế độ sáng" : "Chế độ tối"}</span>
                  </button>
                  <button className="user-menu-item" onClick={handleNotificationClick} type="button">
                    <span className="menu-icon"><FiBell /></span><span>Cài đặt thông báo</span>
                  </button>
                  <div className="menu-divider"></div>
                  <button className="user-menu-item" onClick={goToSupport} type="button">
                    <span className="menu-icon"><FiHelpCircle /></span><span>Trợ giúp & Hỗ trợ</span>
                  </button>
                  <button className="user-menu-item" onClick={handleLogout} type="button">
                    <span className="menu-icon"><FiLogOut /></span><span>Đăng xuất</span>
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
