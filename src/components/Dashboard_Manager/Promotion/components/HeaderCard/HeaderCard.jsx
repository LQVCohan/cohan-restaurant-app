import React from "react";
import { Store, Ticket, Activity, TrendingUp, Gift } from "lucide-react";
import { RESTAURANTS } from "../../../../../utils/constants";
import "./HeaderCard.scss";

const HeaderCard = ({ stats, selectedRestaurant, onRestaurantChange }) => {
  return (
    <div className="header-card">
      {/* --- DÒNG 1: TIÊU ĐỀ & BỘ LỌC --- */}
      <div className="header-top">
        <div className="title-section">
          <div className="icon-box">
            <Gift size={24} color="#fff" />
          </div>
          <div className="text-content">
            <h1>Quản Lý Khuyến Mãi</h1>
            <p className="subtitle">Hệ thống tối ưu doanh thu FoodHub</p>
          </div>
        </div>

        <div className="action-section">
          <div className="custom-select-wrapper">
            <Store size={16} className="select-icon" />
            <select
              className="restaurant-selector"
              value={selectedRestaurant}
              onChange={(e) => onRestaurantChange(e.target.value)}
            >
              <option value="all">Tất cả nhà hàng</option>
              {Object.entries(RESTAURANTS).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
            <div className="arrow-icon" />
          </div>
        </div>
      </div>

      <div className="divider" />

      {/* --- DÒNG 2: CHỈ SỐ (STATS) --- */}
      <div className="header-bottom">
        <div className="stat-card blue">
          <div className="stat-icon">
            <Ticket size={22} />
          </div>
          <div className="stat-content">
            <span className="label">Tổng Voucher</span>
            <span className="value">{stats.total}</span>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon">
            <Activity size={22} />
          </div>
          <div className="stat-content">
            <span className="label">Đang chạy</span>
            <span className="value">{stats.active}</span>
          </div>
        </div>

        <div className="stat-card orange">
          <div className="stat-icon">
            <TrendingUp size={22} />
          </div>
          <div className="stat-content">
            <span className="label">Lượt sử dụng</span>
            <span className="value">{stats.totalUsage}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderCard;
