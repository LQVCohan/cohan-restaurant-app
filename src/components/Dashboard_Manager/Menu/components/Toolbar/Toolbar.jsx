import React, { useState } from "react";
import "./Toolbar.scss";

const Toolbar = ({
  searchTerm,
  onSearchChange,
  currentCategory,
  onCategoryChange,
  currentView,
  onViewChange,
  statusFilter,
  onStatusFilterChange,
  onPriceRangeChange,
  onBulkPriceEdit,
  onCreatePromotion,
  onAddCategory,
  categories,
  itemCount,
  minPrice,
  maxPrice,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({
    min: minPrice || "",
    max: maxPrice || "",
  });

  const handlePriceRangeSubmit = () => {
    onPriceRangeChange({
      minPrice: priceRange.min,
      maxPrice: priceRange.max,
    });
  };

  const clearFilters = () => {
    onSearchChange("");
    onCategoryChange("");
    onStatusFilterChange("");
    setPriceRange({ min: "", max: "" });
    onPriceRangeChange({ minPrice: "", maxPrice: "" });
  };

  const hasActiveFilters =
    searchTerm || currentCategory || statusFilter || minPrice || maxPrice;

  return (
    <div className="toolbar">
      {/* Main Toolbar */}
      <div className="toolbar__main">
        {/* Search Section */}
        <div className="toolbar__search">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Tìm kiếm món ăn, danh mục..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {searchTerm && (
              <button
                className="search-clear"
                onClick={() => onSearchChange("")}
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Quick Filters */}
        <div className="toolbar__quick-filters">
          <select
            className="filter-select"
            value={currentCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.icon} {category.name}
              </option>
            ))}
          </select>

          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="available">✅ Có sẵn</option>
            <option value="out_of_stock">❌ Hết hàng</option>
            <option value="hidden">👁️ Ẩn</option>
          </select>

          <button
            className={`filter-toggle ${
              showFilters ? "filter-toggle--active" : ""
            }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            🎛️ Bộ lọc
          </button>
        </div>

        {/* View Controls */}
        <div className="toolbar__view-controls">
          <div className="view-switcher">
            <button
              className={`view-btn ${
                currentView === "grid" ? "view-btn--active" : ""
              }`}
              onClick={() => onViewChange("grid")}
              title="Xem dạng lưới"
            >
              ⊞
            </button>
            <button
              className={`view-btn ${
                currentView === "list" ? "view-btn--active" : ""
              }`}
              onClick={() => onViewChange("list")}
              title="Xem dạng danh sách"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="toolbar__actions">
          <button
            className="action-btn action-btn--secondary"
            onClick={onBulkPriceEdit}
          >
            💰 Chỉnh sửa giá
          </button>
          <button
            className="action-btn action-btn--secondary"
            onClick={onCreatePromotion}
          >
            🎁 Tạo khuyến mãi
          </button>
          <button
            className="action-btn action-btn--primary"
            onClick={onAddCategory}
          >
            ➕ Thêm danh mục
          </button>
        </div>
      </div>

      {/* Advanced Filters */}
      {showFilters && (
        <div className="toolbar__advanced-filters">
          <div className="advanced-filters">
            <div className="filter-group">
              <label className="filter-label">Khoảng giá (VNĐ):</label>
              <div className="price-range">
                <input
                  type="number"
                  className="price-input"
                  placeholder="Từ"
                  value={priceRange.min}
                  onChange={(e) =>
                    setPriceRange((prev) => ({ ...prev, min: e.target.value }))
                  }
                />
                <span className="price-separator">-</span>
                <input
                  type="number"
                  className="price-input"
                  placeholder="Đến"
                  value={priceRange.max}
                  onChange={(e) =>
                    setPriceRange((prev) => ({ ...prev, max: e.target.value }))
                  }
                />
                <button
                  className="price-apply-btn"
                  onClick={handlePriceRangeSubmit}
                >
                  Áp dụng
                </button>
              </div>
            </div>

            <div className="filter-actions">
              {hasActiveFilters && (
                <button className="clear-filters-btn" onClick={clearFilters}>
                  🗑️ Xóa bộ lọc
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="toolbar__summary">
        <div className="summary-info">
          <span className="item-count">📊 Hiển thị {itemCount} món ăn</span>
          {hasActiveFilters && (
            <span className="filter-indicator">🎯 Đang áp dụng bộ lọc</span>
          )}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="active-filters">
            {searchTerm && (
              <span className="filter-tag">
                Tìm kiếm: "{searchTerm}"
                <button onClick={() => onSearchChange("")}>✕</button>
              </span>
            )}
            {currentCategory && (
              <span className="filter-tag">
                Danh mục: {currentCategory}
                <button onClick={() => onCategoryChange("")}>✕</button>
              </span>
            )}
            {statusFilter && (
              <span className="filter-tag">
                Trạng thái:{" "}
                {statusFilter === "available"
                  ? "Có sẵn"
                  : statusFilter === "out_of_stock"
                  ? "Hết hàng"
                  : "Ẩn"}
                <button onClick={() => onStatusFilterChange("")}>✕</button>
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="filter-tag">
                Giá:{" "}
                {minPrice
                  ? `${parseInt(minPrice).toLocaleString("vi-VN")}đ`
                  : "0đ"}{" "}
                -{" "}
                {maxPrice
                  ? `${parseInt(maxPrice).toLocaleString("vi-VN")}đ`
                  : "∞"}
                <button
                  onClick={() => {
                    setPriceRange({ min: "", max: "" });
                    onPriceRangeChange({ minPrice: "", maxPrice: "" });
                  }}
                >
                  ✕
                </button>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Toolbar;
