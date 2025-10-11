import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../../../context/AuthContext";
import "../../../../styles/Homepage/Header.scss";

const Header = ({ onCartToggle, cartItemCount }) => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate("/");
  };

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  return (
    <header className="header">
      <div className="header__container">
        <div className="header__logo">
          <div className="header__logo-icon">🍽️</div>
          <h1 className="header__logo-text">FoodHub</h1>
        </div>

        <nav className="header__nav">
          <a href="#home" className="header__nav-link">
            Trang chủ
          </a>
          <a href="#restaurants" className="header__nav-link">
            Nhà hàng
          </a>
          <a href="#menu" className="header__nav-link">
            Thực đơn
          </a>
          <a href="#contact" className="header__nav-link">
            Liên hệ
          </a>
        </nav>

        <div className="header__actions">
          <div className="header__search">
            <input
              type="text"
              placeholder="Tìm kiếm món ăn..."
              className="header__search-input"
            />
            <span className="header__search-icon">🔍</span>
          </div>

          {user ? (
            <div className="header__user-menu">
              <button className="header__avatar-btn" onClick={toggleUserMenu}>
                <img
                  src="/default-avatar.png"
                  alt="Avatar"
                  className="header__avatar"
                />
                <span className="header__user-name">
                  {user?.fullName || user?.email}
                </span>
                <span className="header__dropdown-arrow">▼</span>
              </button>

              {showUserMenu && (
                <div className="header__dropdown">
                  <div className="header__dropdown-item">
                    <span className="header__user-role">
                      {user?.role === "customer" && "👤 Khách hàng"}
                      {user?.role === "staff" && "👨‍🍳 Nhân viên"}
                      {user?.role === "manager" && "👨‍💼 Quản lý"}
                      {user?.role === "owner" && "👑 Chủ nhà hàng"}
                    </span>
                  </div>
                  <hr className="header__dropdown-divider" />
                  <button
                    className="header__dropdown-item header__dropdown-button"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate("/profile");
                    }}
                  >
                    👤 Thông tin cá nhân
                  </button>
                  <button
                    className="header__dropdown-item header__dropdown-button"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate("/orders");
                    }}
                  >
                    📋 Đơn hàng của tôi
                  </button>
                  <button
                    className="header__dropdown-item header__dropdown-button"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate("/settings");
                    }}
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
              onClick={() => navigate("/login")}
            >
              Đăng nhập
            </button>
          )}

          <button className="header__cart-btn" onClick={onCartToggle}>
            🛒
            {cartItemCount > 0 && (
              <span className="header__cart-count">{cartItemCount}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
