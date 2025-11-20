// src/pages/StaffManagement/components/Header.jsx
import React from "react";
import StatsGrid from "../StatsGrid";
import "./Header.scss";

const Header = ({
  selectedRestaurant,
  onRestaurantChange,
  onAddEmployee,
  onExportData,
  restaurantList = [],
  stats = {},
  loading = false,
}) => {
  const selectedRestaurantName =
    selectedRestaurant === "all"
      ? "Tất cả nhà hàng"
      : restaurantList.find((r) => r.id === selectedRestaurant)?.name ||
        "Chi nhánh";

  return (
    <div className="header-card">
      <div className="header-top">
        <div className="header-left">
          <div className="eyebrow">Bảng điều khiển nhân sự</div>
          <div className="title-row">
            <h1>👥 Quản Lý Nhân Viên</h1>
            <span className="header-chip">Live overview</span>
          </div>
          <div className="header-subtitle">
            Quản lý thông tin, ca làm và tình trạng nhân viên FoodHub
          </div>

          <div className="header-controls">
            <div className="selector-group">
              <label htmlFor="restaurant-selector">Chi nhánh hiển thị</label>
              <select
                id="restaurant-selector"
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

            <div className="header-meta">
              <span className="meta-pill">{selectedRestaurantName}</span>
              <span className="meta-pill muted">
                Cập nhật tự động theo bộ lọc
              </span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button className="btn btn-secondary ghost" onClick={onExportData}>
            📊 Xuất Báo Cáo
          </button>
          <button className="btn btn-primary" onClick={onAddEmployee}>
            ➕ Thêm Nhân Viên
          </button>
        </div>
      </div>

      <div className="header-stats">
        <StatsGrid stats={stats} loading={loading} />
      </div>
    </div>
  );
};

export default Header;
