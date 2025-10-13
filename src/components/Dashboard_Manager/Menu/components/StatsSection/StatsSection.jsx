import React from "react";
import "./StatsSection.scss";

const StatsSection = ({ stats, isCollapsed, onToggleCollapse }) => {
  const formatPrice = (price) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price || 0);

  return (
    <div
      className={`stats-section ${
        isCollapsed ? "stats-section--collapsed" : ""
      }`}
    >
      <div className="stats-section__header">
        <h3 className="stats-section__title">Thống kê</h3>
        <button
          className="stats-section__toggle"
          onClick={onToggleCollapse}
          aria-label={isCollapsed ? "Mở rộng" : "Thu gọn"}
          title={isCollapsed ? "Mở rộng" : "Thu gọn"}
        >
          {isCollapsed ? "▸" : "▾"}
        </button>
      </div>

      <div className="stats-section__content">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card__label">Tổng món</div>
            <div className="stat-card__value">{stats.totalDishes ?? 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card__label">Có sẵn</div>
            <div className="stat-card__value">{stats.availableDishes ?? 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card__label">Danh mục</div>
            <div className="stat-card__value">{stats.totalCategories ?? 0}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card__label">Giá trung bình</div>
            <div className="stat-card__value">
              {formatPrice(stats.avgPrice)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsSection;
