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
    setPriceRange({ min: "", max: "" });
    onPriceRangeChange({ minPrice: "", maxPrice: "" });
  };

  const hasActiveFilters =
    searchTerm || currentCategory || statusFilter || minPrice || maxPrice;

  // Helper để format giá tiền
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

        {/* Action Group Right */}
        <div className="actions-group">
          {/* View Toggle */}
          <div className="view-toggle">
            <button
              className={`toggle-btn ${currentView === "grid" ? "active" : ""}`}
              onClick={() => onViewChange("grid")}
              title="Lưới"
            >
              <FiGrid />
            </button>
            <button
              className={`toggle-btn ${currentView === "list" ? "active" : ""}`}
              onClick={() => onViewChange("list")}
              title="Danh sách"
            >
              <FiList />
            </button>
          </div>

          {/* Primary Actions */}
          <button className="btn btn-secondary" onClick={onBulkPriceEdit}>
            <FiDollarSign /> <span className="hide-mobile">Sửa giá</span>
          </button>
          <button className="btn btn-secondary" onClick={onCreatePromotion}>
            <FiGift /> <span className="hide-mobile">Khuyến mãi</span>
          </button>
          <button className="btn btn-primary" onClick={onAddCategory}>
            <FiPlus /> <span className="hide-mobile">Thêm mới</span>
          </button>
        </div>
      </div>

      {/* --- Middle Bar: Filters --- */}
      <div className="toolbar-filters">
        <div className="filter-row">
          {/* Category Select */}
          <div className="select-wrapper">
            <select
              className={`custom-select ${currentCategory ? "active" : ""}`}
              value={currentCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="select-arrow">
              <FiTag size={14} />
            </div>
          </div>

          {/* Status Select */}
          <div className="select-wrapper">
            <select
              className={`custom-select ${statusFilter ? "active" : ""}`}
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="available">Có sẵn</option>
              <option value="out_of_stock">Hết hàng</option>
              <option value="hidden">Đang ẩn</option>
            </select>
            <div className="select-arrow">
              {statusFilter === "available" ? (
                <FiCheck size={14} />
              ) : statusFilter === "hidden" ? (
                <FiEyeOff size={14} />
              ) : (
                <FiAlertCircle size={14} />
              )}
            </div>
          </div>

          {/* Advanced Filter Toggle */}
          <button
            className={`btn-filter-toggle ${
              showFilters || minPrice || maxPrice ? "active" : ""
            }`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter /> Bộ lọc giá
          </button>
        </div>

        <div className="result-count">
          Hiển thị <strong>{itemCount}</strong> món
        </div>
      </div>

      {/* --- Advanced Price Filter Slide --- */}
      <div className={`advanced-panel ${showFilters ? "open" : ""}`}>
        <div className="price-inputs">
          <label>Khoảng giá:</label>
          <input
            type="number"
            placeholder="0"
            value={priceRange.min}
            onChange={(e) =>
              setPriceRange((p) => ({ ...p, min: e.target.value }))
            }
          />
          <span className="separator">-</span>
          <input
            type="number"
            placeholder="∞"
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
                ? "Có sẵn"
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
            Xóa tất cả
          </button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;
