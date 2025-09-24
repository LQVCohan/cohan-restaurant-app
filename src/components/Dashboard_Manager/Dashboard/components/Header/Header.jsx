import React from "react";
import "./Header.scss";

const Header = ({
  selectedRestaurant,
  onRestaurantChange,
  onSwitchToPOS,
  onGenerateReport,
}) => {
  const restaurants = [
    { value: "all", label: "🏪 Tất cả nhà hàng" },
    { value: "hcm-center", label: "🏢 FoodHub Trung Tâm HCM" },
    { value: "hcm-district7", label: "🌆 FoodHub Quận 7" },
    { value: "hcm-thuduc", label: "🏙️ FoodHub Thủ Đức" },
    { value: "hanoi-center", label: "🏛️ FoodHub Trung Tâm Hà Nội" },
    { value: "hanoi-caugiay", label: "🌸 FoodHub Cầu Giấy" },
    { value: "danang-center", label: "🌊 FoodHub Trung Tâm Đà Nẵng" },
  ];

  return (
    <div className="header-card">
      <div className="header-left">
        <h1>📊 Dashboard Quản Lý</h1>
        <div className="header-subtitle">
          Tổng quan hoạt động nhà hàng FoodHub
        </div>
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
      <div className="header-actions">
        <button className="btn btn-secondary" onClick={onSwitchToPOS}>
          🖥️ Chuyển POS
        </button>
        <button className="btn btn-primary" onClick={onGenerateReport}>
          📈 Báo Cáo
        </button>
      </div>
    </div>
  );
};

export default Header;
