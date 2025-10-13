import React from "react";
import "./Sidebar.scss";

const Sidebar = ({
  categories,
  currentCategory,
  statusFilter,
  minPrice,
  maxPrice,
  onCategorySelect,
  onStatusFilterChange,
  onPriceRangeChange,
  onOpenPriceEdit,
  onOpenPromotion,
  onExportMenu,
  onImportMenu,
  menuItemsCount,
}) => {
  const handlePriceChange = (type, value) => {
    onPriceRangeChange({
      minPrice: type === "min" ? value : minPrice,
      maxPrice: type === "max" ? value : maxPrice,
    });
  };

  return (
    <div className="sidebar_menu">
      {/* Filters Section */}
      <div className="sidebar__section">
        <h3 className="sidebar__title">🔍 Bộ lọc</h3>

        <div className="filter-group">
          <label className="filter-group__label">Trạng thái</label>
          <select
            className="filter-group__select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">Tất cả</option>
            <option value="available">Có sẵn</option>
            <option value="unavailable">Không có sẵn</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-group__label">Khoảng giá</label>
          <div className="price-range">
            <input
              type="number"
              className="price-range__input"
              placeholder="Từ"
              value={minPrice || ""}
              onChange={(e) => handlePriceChange("min", e.target.value)}
            />
            <input
              type="number"
              className="price-range__input"
              placeholder="Đến"
              value={maxPrice || ""}
              onChange={(e) => handlePriceChange("max", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Categories Section */}
      <div className="sidebar__section">
        <h3 className="sidebar__title">📁 Danh mục</h3>
        <ul className="category-list">
          <li
            className={`category-item ${
              currentCategory === "" ? "category-item--active" : ""
            }`}
            onClick={() => onCategorySelect("")}
          >
            <span>Tất cả</span>
            <span className="category-item__count">{menuItemsCount}</span>
          </li>

          {categories.map((category) => {
            const categoryCount = 0; // This should be calculated from filtered items
            return (
              <li
                key={category.id}
                className={`category-item ${
                  currentCategory === category.name
                    ? "category-item--active"
                    : ""
                }`}
                onClick={() => onCategorySelect(category.name)}
              >
                <span>
                  {category.icon} {category.name}
                </span>
                <span className="category-item__count">{categoryCount}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Quick Actions Section */}
      <div className="sidebar__section">
        <h3 className="sidebar__title">⚡ Thao tác nhanh</h3>
        <div className="quick-actions">
          <button
            className="quick-actions__btn quick-actions__btn--warning"
            onClick={onOpenPriceEdit}
          >
            💰 Chỉnh sửa giá
          </button>

          <button
            className="quick-actions__btn quick-actions__btn--success"
            onClick={onOpenPromotion}
          >
            🎉 Tạo khuyến mãi
          </button>

          <button
            className="quick-actions__btn quick-actions__btn--secondary"
            onClick={onExportMenu}
          >
            📤 Xuất Excel
          </button>

          <input
            type="file"
            id="importFile"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={onImportMenu}
          />
          <button
            className="quick-actions__btn quick-actions__btn--secondary"
            onClick={() => document.getElementById("importFile").click()}
          >
            📥 Nhập Excel
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
