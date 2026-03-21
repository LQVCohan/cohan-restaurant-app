import React, { useState, useRef, useEffect } from "react";
import {
  Monitor,
  FileText,
  MapPin,
  ChevronDown,
  Search,
  Bell,
  Check,
} from "lucide-react";
import "./Header.scss";

const Header = ({
  selectedRestaurant,
  restaurants = [],
  onRestaurantChange,
  onSwitchToPOS,
  onGenerateReport,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);

  const restaurantOptions = restaurants.map((r) => ({
    value: r.id,
    label: r.name,
    status: "online",
  }));

  // Xử lý click outside để đóng dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter danh sách dựa trên từ khóa tìm kiếm
  const filteredRestaurants = restaurantOptions.filter((r) =>
    r.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentRestaurantLabel =
    restaurantOptions.find((r) => r.value === selectedRestaurant)?.label ||
    "Chọn chi nhánh";

  const handleSelect = (value) => {
    onRestaurantChange(value);
    setIsDropdownOpen(false);
  };

  return (
    <header className="dashboard-header">
      <div className="header-content">
        {/* Left Side: Brand & Location Selector */}
        <div className="header-left">
          {/* Custom Dropdown */}
          <div className="location-dropdown-wrapper" ref={dropdownRef}>
            <button
              className={`location-btn ${isDropdownOpen ? "active" : ""}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="icon-box">
                <MapPin size={18} />
              </div>
              <div className="location-info">
                <span className="label-tiny">Đang quản lý tại</span>
                <span className="label-main">{currentRestaurantLabel}</span>
              </div>
              <ChevronDown
                size={16}
                className={`arrow-icon ${isDropdownOpen ? "rotate" : ""}`}
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="dropdown-menu fade-in-down">
                <div className="search-box">
                  <Search size={14} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Tìm chi nhánh..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
                <ul className="options-list custom-scrollbar">
                  {filteredRestaurants.map((item) => (
                    <li
                      key={item.value}
                      className={`option-item ${
                        selectedRestaurant === item.value ? "selected" : ""
                      }`}
                      onClick={() => handleSelect(item.value)}
                    >
                      <span className={`status-dot ${item.status}`}></span>
                      <span className="item-label">{item.label}</span>
                      {selectedRestaurant === item.value && (
                        <Check size={14} className="check-icon" />
                      )}
                    </li>
                  ))}
                  {filteredRestaurants.length === 0 && (
                    <li className="no-result">Không tìm thấy kết quả</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Actions & User */}
        <div className="header-right">
          <div className="actions-group">
            <button className="btn-action secondary" onClick={onSwitchToPOS}>
              <Monitor size={18} />
              <span>POS Bán Hàng</span>
            </button>

            <button className="btn-action primary" onClick={onGenerateReport}>
              <FileText size={18} />
              <span>Xuất Báo Cáo</span>
            </button>
          </div>

          <div className="divider"></div>

          <div className="user-nav">
            <button className="btn-icon-circle notification">
              <Bell size={20} />
              <span className="badge-dot"></span>
            </button>
            <div className="user-avatar">
              <img
                src="https://ui-avatars.com/api/?name=Admin+Manager&background=d97706&color=fff"
                alt="Admin"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
