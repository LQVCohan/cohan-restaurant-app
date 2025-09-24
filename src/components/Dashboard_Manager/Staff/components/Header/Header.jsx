import React from "react";
import "./Header.scss";

const Header = ({
  selectedRestaurant,
  onRestaurantChange,
  onAddEmployee,
  onExportData,
}) => {
  const restaurants = [
    { value: "all", label: "🏪 Tất cả nhà hàng" },
    { value: "district1", label: "🏢 FoodHub Quận 1" },
    { value: "district3", label: "🏢 FoodHub Quận 3" },
    { value: "district7", label: "🏢 FoodHub Quận 7" },
    { value: "binh-thanh", label: "🏢 FoodHub Bình Thạnh" },
    { value: "thu-duc", label: "🏢 FoodHub Thủ Đức" },
  ];

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
            {restaurants.map((restaurant) => (
              <option key={restaurant.value} value={restaurant.value}>
                {restaurant.label}
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
