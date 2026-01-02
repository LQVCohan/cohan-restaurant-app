import React from "react";
import { Store, ChevronDown, Monitor, FileText, MapPin } from "lucide-react";
import "./Header.scss";

const Header = ({
  selectedRestaurant,
  onRestaurantChange,
  onSwitchToPOS,
  onGenerateReport,
}) => {
  const restaurants = [
    { value: "all", label: "Tất cả nhà hàng" },
    { value: "hcm-center", label: "FoodHub Trung Tâm HCM" },
    { value: "hcm-district7", label: "FoodHub Quận 7" },
    { value: "hcm-thuduc", label: "FoodHub Thủ Đức" },
    { value: "hanoi-center", label: "FoodHub Trung Tâm Hà Nội" },
    { value: "hanoi-caugiay", label: "FoodHub Cầu Giấy" },
    { value: "danang-center", label: "FoodHub Trung Tâm Đà Nẵng" },
  ];

  return (
    <div className="header-toolbar fade-in">
      {/* Khu vực chọn chi nhánh (Location Selector) */}
      <div className="location-wrapper">
        <div className="location-icon">
          <MapPin size={20} />
        </div>
        <div className="select-container">
          <label className="select-label">Chi nhánh đang làm việc</label>
          <div className="select-input-group">
            <select
              value={selectedRestaurant}
              onChange={(e) => onRestaurantChange(e.target.value)}
              className="custom-select"
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.value} value={restaurant.value}>
                  {restaurant.label}
                </option>
              ))}
            </select>
            <ChevronDown className="arrow-icon" size={16} />
          </div>
        </div>
      </div>

      {/* Khu vực nút bấm (Actions) */}
      <div className="toolbar-actions">
        <button className="btn btn-secondary" onClick={onSwitchToPOS}>
          <Monitor size={18} />
          <span>POS Bán Hàng</span>
        </button>

        <button className="btn btn-primary" onClick={onGenerateReport}>
          <FileText size={18} />
          <span>Xuất Báo Cáo</span>
        </button>
      </div>
    </div>
  );
};

export default Header;
