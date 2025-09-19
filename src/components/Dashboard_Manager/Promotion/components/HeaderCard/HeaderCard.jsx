import React from "react";
import { RESTAURANTS } from "../../../../../utils/constants";
import "./HeaderCard.scss";

const HeaderCard = ({ stats, selectedRestaurant, onRestaurantChange }) => {
  return (
    <div className="header-card">
      <div className="header-left">
        <h1>🎁 Quản Lý Khuyến Mãi</h1>
        <div className="header-subtitle">
          Hệ thống khuyến mãi thông minh FoodHub
        </div>
        <select
          className="restaurant-selector"
          value={selectedRestaurant}
          onChange={(e) => onRestaurantChange(e.target.value)}
        >
          <option value="all">🏪 Tất cả nhà hàng</option>
          {Object.entries(RESTAURANTS).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="header-stats">
        <div className="stat-item">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Tổng KM</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.active}</div>
          <div className="stat-label">Hoạt động</div>
        </div>
        <div className="stat-item">
          <div className="stat-number">{stats.totalUsage}</div>
          <div className="stat-label">Lượt dùng</div>
        </div>
      </div>
    </div>
  );
};

export default HeaderCard;
