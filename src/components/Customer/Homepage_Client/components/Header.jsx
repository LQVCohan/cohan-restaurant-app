import React, { useContext, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "@/context/AuthContext";
import "../../../../styles/Homepage/Header.scss";

const Header = ({ onCartToggle, cartItemCount = 0 }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext) || {};
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [lang, setLang] = useState(() => localStorage.getItem("lang") || "vi");

  const handleLogout = () => {
    logout?.();
    setShowUserMenu(false);
    navigate("/");
  };

  const toggleUserMenu = () => setShowUserMenu((s) => !s);

  const goto = (path) => {
    setShowUserMenu(false);
    if (location.pathname !== path) navigate(path);
  };

  // Lấy 2 từ cuối của tên. Nếu không có fullName → rút gọn email/username
  const shortDisplayName = useMemo(() => {
    const full = user?.fullName?.trim();
    if (full) {
      const parts = full.split(/\s+/);
      return parts.slice(-2).join(" ");
    }
    const fromEmail =
      typeof user?.email === "string"
        ? user.email.split("@")[0]?.replace(/[._-]+/g, " ")
        : "";
    const fromUsername =
      typeof user?.username === "string"
        ? user.username.replace(/[._-]+/g, " ")
        : "";
    const base = fromEmail || fromUsername || "Người dùng";
    const parts = base.trim().split(/\s+/);
    return parts.slice(-2).join(" ");
  }, [user]);

  const roleLabel = useMemo(() => {
    const role = (user?.roleName || user?.role || "").toString().toLowerCase();
    if (role === "customer") return "👤 Khách hàng";
    if (role === "staff") return "👨‍🍳 Nhân viên";
    if (role === "manager") return "👨‍💼 Quản lý";
    if (role === "owner") return "👑 Chủ nhà hàng";
    if (role === "admin") return "🛡️ Admin";
    return "👤 Người dùng";
  }, [user]);

  const handleLangChange = (e) => {
    const next = e.target.value;
    setLang(next);
    localStorage.setItem("lang", next);
    // Sau này có i18n, có thể trigger i18n.changeLanguage(next) ở đây
  };

  return (
    <header className="header">
      <div className="header__container">
        {/* Logo */}
        <button className="header__logo" onClick={() => goto("/")}>
          <div className="header__logo-icon">🍽️</div>
          <h1 className="header__logo-text">FoodHub</h1>
        </button>

        {/* Nav */}
        <nav className="header__nav">
          <button
            className={`header__nav-link${
              location.pathname === "/" ? " is-active" : ""
            }`}
            onClick={() => goto("/")}
          >
            Trang chủ
          </button>
          <button
            className={`header__nav-link${
              location.pathname.startsWith("/restaurants") ? " is-active" : ""
            }`}
            onClick={() => goto("/restaurants")}
          >
            Nhà hàng
          </button>
          <button
            className={`header__nav-link${
              location.pathname === "/menu" ? " is-active" : ""
            }`}
            onClick={() => goto("/menu")}
          >
            Thực đơn
          </button>
          <button
            className={`header__nav-link${
              location.pathname === "/contact" ? " is-active" : ""
            }`}
            onClick={() => goto("/contact")}
          >
            Liên hệ
          </button>
        </nav>

        {/* Actions */}
        <div className="header__actions">
          {/* search (placeholder) */}
          <div className="header__search">
            <input
              type="text"
              placeholder="Tìm món, nhà hàng…"
              className="header__search-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") goto("/restaurants");
              }}
            />
            <span className="header__search-icon">🔍</span>
          </div>

          {/* Language switcher */}
          <div className="header__lang">
            <select
              className="header__lang-select"
              value={lang}
              onChange={handleLangChange}
              aria-label="Language"
              title="Language"
            >
              <option value="vi">VI</option>
              <option value="en">EN</option>
            </select>
          </div>

          {/* User / Auth */}
          {user ? (
            <div className="header__user-menu">
              <button className="header__avatar-btn" onClick={toggleUserMenu}>
                <img
                  src="/default-avatar.png"
                  alt="Avatar"
                  className="header__avatar"
                />
                <span className="header__user-name">{shortDisplayName}</span>
                <span className="header__dropdown-arrow">▼</span>
              </button>

              {showUserMenu && (
                <div className="header__dropdown">
                  <div className="header__dropdown-item">
                    <span className="header__user-role">{roleLabel}</span>
                  </div>
                  <hr className="header__dropdown-divider" />
                  <button
                    className="header__dropdown-item header__dropdown-button"
                    onClick={() => goto("/profile")}
                  >
                    👤 Thông tin cá nhân
                  </button>
                  <button
                    className="header__dropdown-item header__dropdown-button"
                    onClick={() => goto("/orders")}
                  >
                    📋 Đơn hàng của tôi
                  </button>
                  <button
                    className="header__dropdown-item header__dropdown-button"
                    onClick={() => goto("/settings")}
                  >
                    ⚙️ Cài đặt
                  </button>
                  <hr className="header__dropdown-divider" />
                  <button
                    className="header__dropdown-item header__dropdown-button header__logout"
                    onClick={handleLogout}
                  >
                    🚪 Đăng xuất
                  </button>
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

          {/* Cart */}
          <button
            className="header__cart-btn"
            onClick={onCartToggle}
            aria-label="Giỏ hàng"
          >
            🛒
            {Number(cartItemCount) > 0 && (
              <span className="header__cart-count">{cartItemCount}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
