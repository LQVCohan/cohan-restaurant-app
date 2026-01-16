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
  FiDownload,
  FiSliders, // Icon cho sort
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
  sortOption, // New prop
  onSortChange, // New prop
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
  // Local state cho giá để tránh re-render liên tục khi gõ
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
    // Reset sort về mặc định nếu cần
    if (onSortChange) onSortChange("default");
    setPriceRange({ min: "", max: "" });
    onPriceRangeChange({ minPrice: "", maxPrice: "" });
  };

  const hasActiveFilters =
    searchTerm || currentCategory || statusFilter || minPrice || maxPrice;

  const formatCurrency = (val) =>
    val ? parseInt(val).toLocaleString("vi-VN") + "đ" : "";

  return (
    <div className="toolbar-container">
      {/* --- Top Bar: Search & Main Actions --- */}
      <div className="toolbar-top">
        {/* Search Input */}
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Tìm kiếm món ăn, SKU..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-btn" onClick={() => onSearchChange("")}>
              <FiX />
            </button>
          )}
        </div>

        {/* Action Group Right */}
        <div className="actions-group">
          {/* View Toggle */}
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

          {/* New: Export Button (Placeholder for future feature) */}
          <button className="btn btn-secondary" title="Xuất danh sách">
            <FiDownload /> <span className="hide-mobile">Export</span>
          </button>

          {/* Primary Actions */}
          <button className="btn btn-secondary" onClick={onBulkPriceEdit}>
            <FiDollarSign /> <span className="hide-mobile">Sửa giá</span>
          </button>
          <button className="btn btn-secondary" onClick={onCreatePromotion}>
            <FiGift /> <span className="hide-mobile">Khuyến mãi</span>
          </button>
          <button className="btn btn-primary" onClick={onAddCategory}>
            <FiPlus /> <span className="hide-mobile">Thêm món</span>
          </button>
        </div>
      </div>

      {/* --- Middle Bar: Filters & Sort --- */}
      <div className="toolbar-filters">
        <div className="filter-row">
          {/* 1. Sort Dropdown (New) */}
          <div className="select-wrapper">
            <FiSliders className="select-icon" />
            <select
              className={`custom-select ${
                sortOption !== "default" ? "active" : ""
              }`}
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

          {/* 2. Category Select */}
          <div className="select-wrapper">
            <FiTag className="select-icon" />
            <select
              className={`custom-select ${currentCategory ? "active" : ""}`}
              value={currentCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.id || cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <FiChevronDown className="select-arrow" />
          </div>

          {/* 3. Status Select */}
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

          {/* 4. Advanced Filter Toggle */}
          <button
            className={`btn-filter-toggle ${
              showFilters || minPrice || maxPrice ? "active" : ""
            }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter /> Lọc giá
          </button>
        </div>

        <div className="result-count">
          Hiển thị <strong>{itemCount}</strong> kết quả
        </div>
      </div>

      {/* --- Advanced Price Filter Slide --- */}
      <div className={`advanced-panel ${showFilters ? "open" : ""}`}>
        <div className="price-inputs">
          <label>Khoảng giá (VNĐ):</label>
          <input
            type="number"
            placeholder="Thấp nhất"
            value={priceRange.min}
            onChange={(e) =>
              setPriceRange((p) => ({ ...p, min: e.target.value }))
            }
          />
          <span className="separator">-</span>
          <input
            type="number"
            placeholder="Cao nhất"
            value={priceRange.max}
            onChange={(e) =>
              setPriceRange((p) => ({ ...p, max: e.target.value }))
            }
          />
          <button className="btn-apply" onClick={handlePriceRangeSubmit}>
            Áp dụng
          </button>
        </div>
      </div>

      {/* --- Active Filters Chips --- */}
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
              Danh mục: {currentCategory}{" "}
              <FiX onClick={() => onCategoryChange("")} />
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
              Giá: {formatCurrency(minPrice) || "0"} -{" "}
              {formatCurrency(maxPrice) || "∞"}
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
