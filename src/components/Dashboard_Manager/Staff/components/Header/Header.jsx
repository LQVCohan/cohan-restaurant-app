// src/pages/StaffManagement/components/Header.jsx
import React from "react";
import "./Header.scss";

const Header = ({
  selectedRestaurant,
  onRestaurantChange,
  onAddEmployee,
  onExportData,
  restaurantList = [],
}) => {
  return (
    <div className="header-card">
      <div className="header-left">
        <h1>👥 Quản Lý Nhân Viên</h1>
        <div className="header-subtitle">
          Quản lý thông tin và lịch làm việc nhân viên FoodHub
        </div>
        <div className="header-selectors">
          <select
            className="restaurant-selector"
            value={selectedRestaurant}
            onChange={(e) => onRestaurantChange(e.target.value)}
          >
            <option value="all">🏪 Tất cả nhà hàng</option>
            {restaurantList.map((r) => (
              <option key={r.id} value={r.id}>
                {/* nếu trong restaurant có emoji thì xài, không thì mặc định icon */}
                {r.emoji ? `${r.emoji} ${r.name}` : `🏢 ${r.name}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="header-actions">
        <button className="btn btn-secondary" onClick={onExportData}>
          📊 Xuất Báo Cáo
        </button>
        <button className="btn btn-primary" onClick={onAddEmployee}>
          ➕ Thêm Nhân Viên
        </button>
      </div>
    </div>
  );
};

export default Header;
