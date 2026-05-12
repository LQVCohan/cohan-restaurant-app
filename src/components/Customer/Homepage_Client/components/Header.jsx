import React, { useContext, useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import "../../../../styles/Homepage/Header.scss";
import HeaderSearch from "./HeaderSearch.jsx";
import { useCustomerNotifications } from "@/context/CustomerNotificationContext";


const Header = ({ onCartToggle, cartItemCount = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext) || {};
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useCustomerNotifications();

  const counts = {
    vouchers: 3,
    orders: 2,
    favorites: 0,
    notifications: unreadCount,
  };

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotify, setShowNotify] = useState(false);
  const [lang, setLang] = useState("vi");

  const userMenuRef = useRef(null);
  const notifyRef = useRef(null);

  const goto = (path) => {
    setShowUserMenu(false);
    setShowNotify(false);
    if (location.pathname !== path) navigate(path);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notifyRef.current && !notifyRef.current.contains(event.target)) {
        setShowNotify(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout?.();
    setShowUserMenu(false);
    navigate("/login");
  };

  const avatarText = useMemo(() => {
    if (user?.fullName) return user.fullName.substring(0, 2).toUpperCase();
    if (user?.username) return user.username.substring(0, 2).toUpperCase();
    return "US";
  }, [user]);

  const roleLabel = useMemo(() => {
    const r = user?.role || "customer";
    return r === "owner"
      ? "Chủ nhà hàng"
      : r === "admin"
      ? "Quản trị viên"
      : "Khách hàng";
  }, [user]);

  const toggleNotify = () => {
    setShowNotify(!showNotify);
    if (showUserMenu) setShowUserMenu(false);
  };

  const toggleUser = () => {
    setShowUserMenu(!showUserMenu);
    if (showNotify) setShowNotify(false);
  };

  return (
    <header className="header">
      <div className="header__container">
        <button className="header__logo" onClick={() => goto("/")}>
          <div className="header__logo-icon">🍽️</div>
          <h1 className="header__logo-text">FoodHub</h1>
        </button>

        <nav className="header__nav">
          {[
            { path: "/", label: "Trang chủ" },
            { path: "/restaurants", label: "Nhà hàng" },
            { path: "/cus-menu", label: "Thực đơn" },
            { path: "/contact", label: "Liên hệ" },
          ].map((link) => (
            <button
              key={link.path}
              className={`header__nav-link ${
                location.pathname === link.path ? "is-active" : ""
              }`}
              onClick={() => goto(link.path)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="header__actions">
          <div className="header__lang">
            <select value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="vi">VI 🇻🇳</option>
              <option value="en">EN 🇺🇸</option>
            </select>
          </div>

          <HeaderSearch />

          <div className="header__notify" ref={notifyRef}>
            <button
              className={`header__notify-btn ${showNotify ? "is-active" : ""}`}
              onClick={toggleNotify}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
              {counts.notifications > 0 && (
                <span className="badge">{counts.notifications}</span>
              )}
            </button>

            {showNotify && (
              <div className="header__notify-dropdown">
                <div className="header__notify-header">
                  <h3>Thông báo</h3>
                  <button className="mark-read" onClick={markAllAsRead}>
                    Đánh dấu đã đọc
                  </button>
                </div>
                <div className="header__notify-list">
                  {notifications.length === 0 ? (
                    <p className="notify-item__empty">Không có thông báo</p>
                  ) : (
                    notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`notify-item ${!notif.isRead ? "unread" : ""}`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className="notify-item__img">
                        <img src={notif.image} alt="icon" />
                      </div>
                      <div className="notify-item__content">
                        <p className="notify-item__text">{notif.text}</p>
                        <span className="notify-item__time">{notif.time}</span>
                      </div>
                      {!notif.isRead && (
                        <div className="notify-item__dot"></div>
                      )}
                    </div>
                  ))
                  )}
                </div>
                <div className="header__notify-footer">
                  <button onClick={() => goto("/notifications")}>
                    Xem tất cả
                  </button>
                </div>
              </div>
            )}
          </div>

          {user ? (
            <div className="header__user-menu" ref={userMenuRef}>
              <button
                className={`header__user-btn ${
                  showUserMenu ? "is-active" : ""
                }`}
                onClick={toggleUser}
              >
                <div className="header__avatar">
                  {user.avatar ? (
                    <img src={user.avatar} alt="avt" />
                  ) : (
                    avatarText
                  )}
                </div>
                <div className="header__user-info">
                  <span className="header__username">
                    {user.fullName || user.username}
                  </span>
                  <span className="header__user-arrow">▼</span>
                </div>
              </button>

              {showUserMenu && (
                <div className="header__user-dropdown">
                  <div className="header__user-dropdown-header">
                    <p className="user-name">
                      {user.fullName || user.username}
                    </p>
                    <p className="user-role">{roleLabel}</p>
                  </div>
                  <div className="header__user-dropdown-body">
                    <button
                      className="header__menu-item"
                      onClick={() => goto("/profile")}
                    >
                      <span className="header__item-label">
                        👤 Hồ sơ cá nhân
                      </span>
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto(`/vouchers/${user.id}`)}
                    >
                      <span className="header__item-label">🎟️ Kho Coupon</span>
                      {counts.vouchers > 0 && (
                        <span className="header__item-badge">
                          {counts.vouchers}
                        </span>
                      )}
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto("/orders")}
                    >
                      <span className="header__item-label">
                        📦 Đơn hàng của tôi
                      </span>
                      {counts.orders > 0 && (
                        <span className="header__item-badge highlight">
                          {counts.orders}
                        </span>
                      )}
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto(`/favorites/${user.id}`)}
                    >
                      <span className="header__item-label">❤️ Yêu thích</span>
                    </button>
                    <button
                      className="header__menu-item"
                      onClick={() => goto(`/address-book/${user.id}`)}
                    >
                      <span className="header__item-label">📍 Sổ địa chỉ</span>
                    </button>
                    <div className="divider"></div>
                    <button
                      className="header__menu-item"
                      onClick={() => goto(`/help-center/${user.id}`)}
                    >
                      <span className="header__item-label">❓ Trợ giúp</span>
                    </button>
                    <button
                      className="header__menu-item logout-btn"
                      onClick={handleLogout}
                    >
                      <span className="header__item-label">🚪 Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              className="header__login-btn"
              onClick={() => goto("/login")}
            >
              Đăng nhập
            </button>
          )}

          <button className="header__cart-btn" onClick={onCartToggle}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            {cartItemCount > 0 && (
              <span className="badge">{cartItemCount}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
