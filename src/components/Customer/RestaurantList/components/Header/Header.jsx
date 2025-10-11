import React from "react";
import "./Header.scss";

const Header = () => {
  return (
    <header className="header">
      <div className="header__content">
        <a href="#" className="header__logo">
          🍽️ FoodHub
        </a>
        <nav className="header__nav">
          <a href="#" className="header__nav-link">
            Trang chủ
          </a>
          <a href="#" className="header__nav-link header__nav-link--active">
            Nhà hàng
          </a>
          <a href="#" className="header__nav-link">
            Khuyến mãi
          </a>
          <a href="#" className="header__nav-link">
            Về chúng tôi
          </a>
        </nav>
        <div className="header__actions">
          <button className="btn btn--secondary">🔍 Tìm kiếm</button>
          <button className="btn btn--primary">👤 Đăng nhập</button>
        </div>
      </div>
    </header>
  );
};

export default Header;
