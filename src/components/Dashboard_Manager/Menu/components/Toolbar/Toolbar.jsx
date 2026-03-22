import React, { useState } from "react";
import {
  FiSearch,
  FiX,
  FiFilter,
  FiGrid,
  FiList,
  FiPlus,
  FiTag,
  FiDollarSign,
  FiGift,
  FiCheck,
  FiEyeOff,
  FiAlertCircle,
  FiChevronDown,
  FiSliders,
} from "react-icons/fi";
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
  sortOption,
  onSortChange,
  onPriceRangeChange,
  onBulkPriceEdit,
  onCreatePromotion,
  onAddCategory,
  categories = [],
  itemCount = 0,
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
    if (onSortChange) onSortChange("default");
    setPriceRange({ min: "", max: "" });
    onPriceRangeChange({ minPrice: "", maxPrice: "" });
  };

  const hasActiveFilters =
    searchTerm || currentCategory || statusFilter || minPrice || maxPrice;

  const formatCurrency = (val) =>
    val ? parseInt(val, 10).toLocaleString("vi-VN") + "đ" : "";

  return (
    <div className="toolbar-container">
      <div className="toolbar-top">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Tìm kiếm món ăn..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-btn" onClick={() => onSearchChange("")}>
              <FiX />
            </button>
          )}
        </div>

        <div className="actions-group">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${currentView === "grid" ? "active" : ""}`}
              onClick={() => onViewChange("grid")}
              title="Xem dạng Lưới"
            >
              <FiGrid />
            </button>
            <button
              className={`toggle-btn ${currentView === "list" ? "active" : ""}`}
              onClick={() => onViewChange("list")}
              title="Xem dạng Danh sách"
            >
              <FiList />
            </button>
          </div>

          <button className="btn btn-secondary" onClick={onBulkPriceEdit}>
            <FiDollarSign /> <span className="hide-mobile">Sửa giá</span>
          </button>
          {onCreatePromotion && (
            <button className="btn btn-secondary" onClick={onCreatePromotion}>
              <FiGift /> <span className="hide-mobile">Khuyến mãi</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={onAddCategory}>
            <FiPlus /> <span className="hide-mobile">Danh mục</span>
          </button>
        </div>
      </div>

      <div className="toolbar-filters">
        <div className="filter-row">
          <div className="select-wrapper">
            <FiSliders className="select-icon" />
            <select
              className={`custom-select ${sortOption !== "default" ? "active" : ""}`}
              value={sortOption}
              onChange={(e) => onSortChange && onSortChange(e.target.value)}
            >
              <option value="default">Mặc định</option>
              <option value="name_asc">Tên (A-Z)</option>
              <option value="name_desc">Tên (Z-A)</option>
              <option value="price_asc">Giá (Thấp - Cao)</option>
              <option value="price_desc">Giá (Cao - Thấp)</option>
            </select>
            <FiChevronDown className="select-arrow" />
          </div>

          <div className="select-wrapper">
            <FiTag className="select-icon" />
            <select
              className={`custom-select ${currentCategory ? "active" : ""}`}
              value={currentCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <FiChevronDown className="select-arrow" />
          </div>

          <div className="select-wrapper">
            {statusFilter === "available" ? (
              <FiCheck className="select-icon" />
            ) : statusFilter === "hidden" ? (
              <FiEyeOff className="select-icon" />
            ) : statusFilter === "out_of_stock" ? (
              <FiAlertCircle className="select-icon" />
            ) : (
              <FiCheck className="select-icon" style={{ opacity: 0.5 }} />
            )}
            <select
              className={`custom-select ${statusFilter ? "active" : ""}`}
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="available">Đang bán</option>
              <option value="out_of_stock">Hết hàng</option>
              <option value="hidden">Đang ẩn</option>
            </select>
            <FiChevronDown className="select-arrow" />
          </div>

          <button
            className={`btn-filter-toggle ${showFilters || minPrice || maxPrice ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter /> Lọc giá
          </button>
        </div>

        <div className="result-count">
          Hiển thị <strong>{itemCount}</strong> kết quả
        </div>
      </div>

      <div className={`advanced-panel ${showFilters ? "open" : ""}`}>
        <div className="price-inputs">
          <label>Khoảng giá (VNĐ):</label>
          <input
            type="number"
            placeholder="Thấp nhất"
            value={priceRange.min}
            onChange={(e) => setPriceRange((p) => ({ ...p, min: e.target.value }))}
          />
          <span className="separator">-</span>
          <input
            type="number"
            placeholder="Cao nhất"
            value={priceRange.max}
            onChange={(e) => setPriceRange((p) => ({ ...p, max: e.target.value }))}
          />
          <button className="btn-apply" onClick={handlePriceRangeSubmit}>
            Áp dụng
          </button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="active-chips-area">
          <span className="label">Đang lọc:</span>
          {searchTerm && (
            <span className="chip">
              Tìm: "{searchTerm}" <FiX onClick={() => onSearchChange("")} />
            </span>
          )}
          {currentCategory && (
            <span className="chip">
              Danh mục đã chọn <FiX onClick={() => onCategoryChange("")} />
            </span>
          )}
          {statusFilter && (
            <span className="chip">
              {statusFilter === "available"
                ? "Đang bán"
                : statusFilter === "out_of_stock"
                ? "Hết hàng"
                : "Ẩn"}
              <FiX onClick={() => onStatusFilterChange("")} />
            </span>
          )}
          {(minPrice || maxPrice) && (
            <span className="chip">
              Giá: {formatCurrency(minPrice) || "0"} - {formatCurrency(maxPrice) || "∞"}
              <FiX
                onClick={() => {
                  setPriceRange({ min: "", max: "" });
                  onPriceRangeChange({ minPrice: "", maxPrice: "" });
                }}
              />
            </span>
          )}
          <button className="clear-all-text" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
