import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiBell, FiCheckCircle, FiChevronDown, FiHelpCircle, FiInfo, FiLogOut, FiMoon, FiSettings, FiUser } from "react-icons/fi";
import SearchBox from "../SearchBox/SearchBox";
import ManagerAccountCenter from "./Account/ManagerAccountCenter";
import RestaurantCuisineOnboarding from "./RestaurantSetup/RestaurantCuisineOnboarding";
import "./Styles/Header.scss";
import "./Styles/HeaderShellFix.scss";
import "./Account/ManagerAccountOverlay.scss";
import { AuthContext } from "@/context/AuthContext";
import { getDisplayUser, getInitials, resolveUserAvatarSrc } from "@/lib/userAvatar";
import { getBrandRoleLabel, getCombinedRoleLabel, getMembershipScopeLabel, getRoleTooltip, getSystemRoleLabel } from "@/lib/userRoleDisplay";
import { isAdminRole } from "@/utils/frontendRoleAccess";

const getNotificationIcon = (type) => {
  if (type === "success") return <FiCheckCircle />;
  if (type === "warning") return <FiAlertTriangle />;
  if (type === "primary") return <FiInfo />;
  return <FiBell />;
};

const readBadgePreference = () => {
  try {
    return JSON.parse(localStorage.getItem("manager.notificationPreferences") || "{}").showBadge !== false;
  } catch {
    return true;
  }
};

const readSelectedRestaurantId = () =>
  typeof localStorage === "undefined"
    ? ""
    : localStorage.getItem("manager.selectedRestaurantId") || "";

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
  const [accountTab, setAccountTab] = useState(null);
  const [localNotifications, setLocalNotifications] = useState(notifications);
  const [showBadge, setShowBadge] = useState(readBadgePreference);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("manager.darkMode") === "1");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState(readSelectedRestaurantId);
  const notificationRef = useRef(null);
  const userMenuRef = useRef(null);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const normalizedUser = useMemo(() => getDisplayUser(user), [user]);
  const systemRoleLabel = useMemo(() => getSystemRoleLabel(user), [user]);
  const brandRoleLabel = useMemo(() => getBrandRoleLabel({ user, activeBrand }), [activeBrand, user]);
  const membership = activeBrand?.membership || (activeBrand?.membershipRole ? { role: activeBrand.membershipRole, restaurantIds: activeBrand.restaurantIds || [] } : null);
  const scopeLabel = useMemo(() => getMembershipScopeLabel(membership || { role: activeBrand?.membershipRole }, activeBrand?.restaurants, activeBrand?.name), [activeBrand, membership]);
  const roleLine = useMemo(() => getCombinedRoleLabel({ user, activeBrand, membership }), [activeBrand, membership, user]);
  const roleTooltip = useMemo(() => getRoleTooltip({ user, activeBrand, membership }), [activeBrand, membership, user]);
  const avatarSrc = useMemo(() => resolveUserAvatarSrc(normalizedUser), [normalizedUser]);
  const avatarFallback = useMemo(() => getInitials(normalizedUser.fullName), [normalizedUser.fullName]);
  const selectedRestaurant = useMemo(
    () => (activeBrand?.restaurants || []).find(
      (restaurant) => String(restaurant?.id || restaurant?._id || "") === selectedRestaurantId,
    ) || null,
    [activeBrand?.restaurants, selectedRestaurantId],
  );
  const showCuisineOnboarding = !isAdminRole(user) && selectedRestaurant?.initialSetup?.status === "pending";
  const unreadCount = localNotifications.filter((item) => !item.read).length;

  useEffect(() => setLocalNotifications(Array.isArray(notifications) ? notifications : []), [notifications]);
  useEffect(() => setAvatarImageFailed(false), [avatarSrc]);
  useEffect(() => {
    document.body.classList.toggle("manager-dark-mode", isDarkMode);
    localStorage.setItem("manager.darkMode", isDarkMode ? "1" : "0");
    return () => document.body.classList.remove("manager-dark-mode");
  }, [isDarkMode]);
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const handler = (event) => setShowBadge(event.detail?.showBadge !== false);
    window.addEventListener("manager:notification-preferences", handler);
    return () => window.removeEventListener("manager:notification-preferences", handler);
  }, []);
  useEffect(() => {
    const handler = (event) => {
      if (event?.detail?.key === "manager.selectedRestaurantId") {
        setSelectedRestaurantId(String(event.detail.value || ""));
      }
    };
    window.addEventListener("manager:scope-selection", handler);
    return () => window.removeEventListener("manager:scope-selection", handler);
  }, []);
  useEffect(() => {
    const handler = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) setShowNotifications(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const renderAvatar = (className, showStatus = false) => (
    <div className={className}>
      {avatarSrc && !avatarImageFailed ? <img src={avatarSrc} alt={normalizedUser.fullName} onError={() => setAvatarImageFailed(true)} /> : <span className="user-avatar-initials">{avatarFallback}</span>}
      {showStatus && <div className="user-status" />}
    </div>
  );

  const closeMenus = () => { setShowNotifications(false); setShowUserMenu(false); };
  const openAccount = (tab) => { closeMenus(); setAccountTab(tab); };
  const formatTime = () => currentTime.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const formatDate = () => currentTime.toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const openNotificationAction = (notification) => {
    setLocalNotifications((prev) => prev.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    onNotificationSelect?.(notification);
    const actionUrl = notification.actionUrl;
    if (actionUrl?.startsWith("/manager")) {
      const url = new URL(actionUrl, window.location.origin);
      window.dispatchEvent(new CustomEvent("manager:navigate", { detail: { page: url.hash.replace("#", "") || "dashboard", query: Object.fromEntries(url.searchParams.entries()), source: "notification" } }));
    } else if (actionUrl) navigate(actionUrl);
    setShowNotifications(false);
  };

  const handleNotificationKeyDown = (event, notification) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openNotificationAction(notification);
  };

  const handleLogout = () => { closeMenus(); logout?.(); };
  const toggleDarkMode = () => { setIsDarkMode((value) => !value); setShowUserMenu(false); };

  return (
    <>
      <header className={`header ${sidebarOpen ? "header--compact" : ""}`}>
        <div className="header__content">
          <div className="header__left">
            <button className={`sidebar-toggle ${sidebarOpen ? "active" : ""}`} onClick={onToggleSidebar} type="button" aria-label={sidebarOpen ? "Thu gọn sidebar" : "Mở rộng sidebar"} aria-expanded={sidebarOpen}>
              <div className="hamburger"><span className="hamburger-line" /><span className="hamburger-line" /><span className="hamburger-line" /></div>
            </button>
            <div className="page-info"><h1 className="page-title">{pageTitle}</h1><span className="page-subtitle">{formatDate()}</span></div>
          </div>

          <div className="header__center"><SearchBox items={searchItems} onSelectItem={onSelectSearchResult} placeholder="Tìm kiếm trang quản lý..." /></div>
          {scopeSelector && <div className="header__scope">{scopeSelector}</div>}

          <div className="header__right">
            <div className="time-display hide-mobile"><div className="current-time">{formatTime()}</div><div className="current-status"><span className="status-dot" />Đang hoạt động</div></div>

            <div className="notification-container" ref={notificationRef}>
              <button className={`notification-btn ${showNotifications ? "notification-btn--active" : ""}`} onClick={() => { setShowNotifications((value) => !value); setShowUserMenu(false); }} type="button" aria-label="Mở thông báo" aria-expanded={showNotifications}>
                <FiBell />{showBadge && unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
              </button>
              {showNotifications && (
                <div className="notification-dropdown">
                  <div className="notification-header"><h3>Thông báo</h3><button className="mark-all-read" onClick={() => { setLocalNotifications((prev) => prev.map((item) => ({ ...item, read: true }))); onMarkAllNotificationsRead?.(); }} type="button">Đánh dấu đã đọc</button></div>
                  <div className="notification-list">
                    {localNotifications.length ? localNotifications.map((notification, index) => (
                      <div key={notification.id || index} role="button" tabIndex={0} className={`notification-item ${!notification.read ? "notification-item--unread" : ""}`} onClick={() => openNotificationAction(notification)} onKeyDown={(event) => handleNotificationKeyDown(event, notification)}>
                        <div className={`notification-icon notification-icon--${notification.type}`}>{getNotificationIcon(notification.type)}</div>
                        <div className="notification-content"><h4>{notification.title}</h4><p>{notification.message}</p><span className="notification-time">{notification.time}</span></div>
                        {!notification.read && <div className="unread-dot" />}
                      </div>
                    )) : <div className="notification-empty"><p>Không có thông báo mới</p></div>}
                  </div>
                </div>
              )}
            </div>

            <div className="user-menu-container" ref={userMenuRef}>
              <button className={`user-menu-btn ${showUserMenu ? "user-menu-btn--active" : ""}`} onClick={() => { setShowUserMenu((value) => !value); setShowNotifications(false); }} type="button" aria-label="Mở menu tài khoản" aria-expanded={showUserMenu} title={roleTooltip}>
                {renderAvatar("user-avatar", true)}
                <div className="user-info"><span className="user-name">{normalizedUser.fullName}</span><span className="user-roleName">{roleLine}</span></div>
                <span className="user-chevron"><FiChevronDown /></span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="user-dropdown-header">
                    {renderAvatar("user-avatar-large")}
                    <div className="user-details"><h3>{normalizedUser.fullName}</h3><p>{normalizedUser.email}</p><span className="user-badge">{brandRoleLabel || systemRoleLabel}</span></div>
                    <div className="user-role-breakdown"><span>Cấp tài khoản: <strong>{systemRoleLabel}</strong></span><span>Quyền trong chuỗi: <strong>{brandRoleLabel || "Chưa tham gia chuỗi"}</strong></span><span>Phạm vi quản lý: <strong>{scopeLabel}</strong></span></div>
                  </div>
                  <div className="user-menu-items">
                    <button className="user-menu-item" type="button" onClick={() => openAccount("profile")}><span className="menu-icon"><FiUser /></span><span>Thông tin cá nhân</span></button>
                    <button className="user-menu-item" type="button" onClick={() => openAccount("security")}><span className="menu-icon"><FiSettings /></span><span>Cài đặt tài khoản</span></button>
                    <button className="user-menu-item" type="button" onClick={toggleDarkMode}><span className="menu-icon"><FiMoon /></span><span>{isDarkMode ? "Chế độ sáng" : "Chế độ tối"}</span></button>
                    <button className="user-menu-item" type="button" onClick={() => openAccount("notifications")}><span className="menu-icon"><FiBell /></span><span>Cài đặt thông báo</span></button>
                    <div className="menu-divider" />
                    <button className="user-menu-item" type="button" onClick={() => openAccount("support")}><span className="menu-icon"><FiHelpCircle /></span><span>Trợ giúp & Hỗ trợ</span></button>
                    <button className="user-menu-item" type="button" onClick={handleLogout}><span className="menu-icon"><FiLogOut /></span><span>Đăng xuất</span></button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      {accountTab && <ManagerAccountCenter initialTab={accountTab} onClose={() => setAccountTab(null)} />}
      {showCuisineOnboarding && (
        <RestaurantCuisineOnboarding
          key={selectedRestaurant.id || selectedRestaurant._id}
          restaurant={selectedRestaurant}
        />
      )}
    </>
  );
};

export default Header;