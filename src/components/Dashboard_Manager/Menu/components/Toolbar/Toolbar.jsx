import React, { useState } from "react";
import {
  FiSearch,
  FiX,
  FiFilter,
  FiGrid,
  FiList,
  FiTag,
  FiDollarSign,
  FiGift,
  FiCheck,
  FiEyeOff,
  FiAlertCircle,
  FiChevronDown,
  FiSliders,
  FiFolderPlus,
} from "react-icons/fi";
import "./Toolbar.scss";
import "../../MenuManagementUsability.scss";

const STATUS_OPTIONS = [
  { value: "available", label: "Đang bán" },
  { value: "unavailable", label: "Tạm dừng" },
  { value: "out_of_stock", label: "Hết hàng" },
  { value: "hidden", label: "Đang ẩn" },
];

const STATUS_LABELS = STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const ISSUE_LABELS = {
  missing_info: "Thiếu khẩu vị/dị ứng",
  low_stock: "Sắp hết nguyên liệu",
  out_of_stock: "Hết nguyên liệu",
  needs_check: "Cần kiểm kho",
  not_tracked: "Thiếu công thức",
};

const INVENTORY_FILTER_LABELS = {
  low_stock: "Sắp hết nguyên liệu",
  out_of_stock: "Hết nguyên liệu",
  needs_check: "Cần kiểm kho",
  not_tracked: "Thiếu công thức",
};

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
  onAddDishCategory,
  onAddMenuGroup,
  onAddCategory,
  categories = [],
  itemCount = 0,
  minPrice,
  maxPrice,
  inventoryFilter = "all",
  onInventoryFilterChange,
  inventoryFilterCounts = {},
  forYouMetadataFilter = "all",
  onForYouMetadataFilterChange,
  forYouMetadataCounts = {},
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
    onInventoryFilterChange?.("all");
    onForYouMetadataFilterChange?.("all");
    onSortChange?.("default");
    setPriceRange({ min: "", max: "" });
    onPriceRangeChange({ minPrice: "", maxPrice: "" });
  };

  const hasActiveFilters =
    searchTerm || currentCategory || statusFilter || minPrice || maxPrice || inventoryFilter !== "all" || forYouMetadataFilter !== "all";

  const formatCurrency = (val) =>
    val ? parseInt(val, 10).toLocaleString("vi-VN") + "đ" : "";

  const issueFilterValue =
    forYouMetadataFilter === "missing"
      ? "missing_info"
      : inventoryFilter !== "all"
        ? inventoryFilter
        : "all";

  const handleIssueFilterChange = (value) => {
    if (value === "all") {
      onForYouMetadataFilterChange?.("all");
      onInventoryFilterChange?.("all");
      return;
    }
    if (value === "missing_info") {
      onForYouMetadataFilterChange?.("missing");
      onInventoryFilterChange?.("all");
      return;
    }
    onForYouMetadataFilterChange?.("all");
    onInventoryFilterChange?.(value);
  };

  const renderStatusIcon = () => {
    switch (statusFilter) {
      case "available":
        return <FiCheck className="select-icon" />;
      case "unavailable":
        return <FiAlertCircle className="select-icon" />;
      case "hidden":
        return <FiEyeOff className="select-icon" />;
      case "out_of_stock":
        return <FiAlertCircle className="select-icon" />;
      default:
        return <FiCheck className="select-icon select-icon--muted" />;
    }
  };

  const handleAddDishCategory = onAddDishCategory || onAddCategory;
  const handleAddMenuGroup = onAddMenuGroup || onAddCategory;

  return (
    <section className="toolbar-container toolbar-container--manager" aria-label="Tìm và lọc món ăn">
      <div className="toolbar-top">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <label className="toolbar-sr-label" htmlFor="menu-search-input">Tìm món</label>
          <input
            id="menu-search-input"
            type="text"
            className="search-input"
            placeholder="Tìm tên món, mô tả hoặc ghi chú..."
            aria-label="Tìm món"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchTerm && (
            <button type="button" className="clear-btn" aria-label="Xóa từ khóa tìm kiếm" title="Xóa tìm kiếm" onClick={() => onSearchChange("")}>
              <FiX />
            </button>
          )}
        </div>

        <div className="actions-group">
          <div className="view-toggle">
            <button
              type="button"
              className={`toggle-btn ${currentView === "grid" ? "active" : ""}`}
              onClick={() => onViewChange("grid")}
              aria-label="Hiển thị dạng thẻ"
              title="Xem dạng thẻ"
            >
              <FiGrid />
            </button>
            <button
              type="button"
              className={`toggle-btn ${currentView === "list" ? "active" : ""}`}
              onClick={() => onViewChange("list")}
              aria-label="Hiển thị dạng danh sách"
              title="Xem dạng danh sách"
            >
              <FiList />
            </button>
          </div>

          {onBulkPriceEdit && (
            <button type="button" className="btn btn-secondary" onClick={onBulkPriceEdit}>
              <FiDollarSign /> <span className="hide-mobile">Sửa giá</span>
            </button>
          )}
          {onCreatePromotion && (
            <button type="button" className="btn btn-secondary" onClick={onCreatePromotion}>
              <FiGift /> <span className="hide-mobile">Khuyến mãi</span>
            </button>
          )}
          {handleAddDishCategory && (
            <button type="button" className="btn btn-secondary" onClick={handleAddDishCategory}>
              <FiTag /> <span className="hide-mobile">Danh mục</span>
            </button>
          )}
          {handleAddMenuGroup && (
            <button type="button" className="btn btn-primary" onClick={handleAddMenuGroup}>
              <FiFolderPlus /> <span className="hide-mobile">Nhóm thực đơn</span>
            </button>
          )}
        </div>
      </div>

      <div className="toolbar-filters toolbar-filters--single-row">
        <span className="filter-section-label">Bộ lọc</span>
        <div className="select-wrapper">
          <FiSliders className="select-icon" />
          <label className="toolbar-sr-label" htmlFor="menu-sort-select">Sắp xếp món</label>
          <select
            id="menu-sort-select"
            aria-label="Sắp xếp món"
            className={`custom-select ${sortOption !== "default" ? "active" : ""}`}
            value={sortOption}
            onChange={(e) => onSortChange?.(e.target.value)}
          >
            <option value="default">Mặc định</option>
            <option value="name_asc">Tên A-Z</option>
            <option value="name_desc">Tên Z-A</option>
            <option value="price_asc">Giá thấp trước</option>
            <option value="price_desc">Giá cao trước</option>
          </select>
          <FiChevronDown className="select-arrow" />
        </div>

        <div className="select-wrapper">
          <FiTag className="select-icon" />
          <label className="toolbar-sr-label" htmlFor="menu-category-select">Danh mục</label>
          <select
            id="menu-category-select"
            aria-label="Lọc theo danh mục"
            className={`custom-select ${currentCategory ? "active" : ""}`}
            value={currentCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
          >
            <option value="">Tất cả danh mục</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <FiChevronDown className="select-arrow" />
        </div>

        <div className="select-wrapper">
          {renderStatusIcon()}
          <label className="toolbar-sr-label" htmlFor="menu-status-select">Trạng thái bán</label>
          <select
            id="menu-status-select"
            aria-label="Lọc theo trạng thái bán"
            className={`custom-select ${statusFilter ? "active" : ""}`}
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <FiChevronDown className="select-arrow" />
        </div>

        <div className="select-wrapper">
          <FiAlertCircle className="select-icon" />
          <label className="toolbar-sr-label" htmlFor="menu-issue-select">Vấn đề cần xử lý</label>
          <select
            id="menu-issue-select"
            aria-label="Lọc theo vấn đề cần xử lý"
            className={`custom-select ${issueFilterValue !== "all" ? "active" : ""}`}
            value={issueFilterValue}
            onChange={(e) => handleIssueFilterChange(e.target.value)}
          >
            <option value="all">Tất cả vấn đề</option>
            <option value="missing_info">Thiếu khẩu vị/dị ứng ({forYouMetadataCounts.missing || 0})</option>
            <option value="low_stock">Sắp hết nguyên liệu ({inventoryFilterCounts.low_stock || 0})</option>
            <option value="out_of_stock">Hết nguyên liệu ({inventoryFilterCounts.out_of_stock || 0})</option>
            <option value="needs_check">Cần kiểm kho ({inventoryFilterCounts.needs_check || 0})</option>
            <option value="not_tracked">Thiếu công thức ({inventoryFilterCounts.not_tracked || 0})</option>
          </select>
          <FiChevronDown className="select-arrow" />
        </div>

        <button
          type="button"
          className={`btn-filter-toggle ${showFilters || minPrice || maxPrice ? "active" : ""}`}
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
        >
          <FiFilter /> Giá
        </button>

        <div className="result-count">
          <strong>{itemCount}</strong> món
        </div>
      </div>

      <div className={`advanced-panel ${showFilters ? "open" : ""}`}>
        <div className="price-inputs">
          <label>Khoảng giá:</label>
          <input
            id="menu-min-price"
            type="number"
            aria-label="Giá thấp nhất"
            placeholder="Từ"
            value={priceRange.min}
            onChange={(e) => setPriceRange((p) => ({ ...p, min: e.target.value }))}
          />
          <span className="separator">-</span>
          <input
            id="menu-max-price"
            type="number"
            aria-label="Giá cao nhất"
            placeholder="Đến"
            value={priceRange.max}
            onChange={(e) => setPriceRange((p) => ({ ...p, max: e.target.value }))}
          />
          <button type="button" className="btn-apply" onClick={handlePriceRangeSubmit}>Áp dụng</button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="active-chips-area">
          <span className="label">Đang lọc:</span>
          {searchTerm && (
            <span className="chip">Tìm: "{searchTerm}" <button type="button" className="chip-x" aria-label="Xóa lọc tìm kiếm" title="Xóa lọc tìm kiếm" onClick={() => onSearchChange("")}><FiX /></button></span>
          )}
          {currentCategory && (
            <span className="chip">Danh mục đã chọn <button type="button" className="chip-x" aria-label="Xóa lọc danh mục" title="Xóa lọc danh mục" onClick={() => onCategoryChange("")}><FiX /></button></span>
          )}
          {statusFilter && (
            <span className="chip">{STATUS_LABELS[statusFilter] || statusFilter}<button type="button" className="chip-x" aria-label="Xóa lọc trạng thái" title="Xóa lọc trạng thái" onClick={() => onStatusFilterChange("")}><FiX /></button></span>
          )}
          {forYouMetadataFilter !== "all" && (
            <span className="chip">Thiếu khẩu vị/dị ứng<button type="button" className="chip-x" aria-label="Xóa lọc khẩu vị" title="Xóa lọc khẩu vị" onClick={() => onForYouMetadataFilterChange?.("all")}><FiX /></button></span>
          )}
          {inventoryFilter !== "all" && (
            <span className="chip">{INVENTORY_FILTER_LABELS[inventoryFilter] || inventoryFilter}<button type="button" className="chip-x" aria-label="Xóa lọc tồn kho" title="Xóa lọc tồn kho" onClick={() => onInventoryFilterChange?.("all")}><FiX /></button></span>
          )}
          {(minPrice || maxPrice) && (
            <span className="chip">
              Giá: {formatCurrency(minPrice) || "0"} - {formatCurrency(maxPrice) || "∞"}
              <button type="button" className="chip-x" aria-label="Xóa lọc giá" title="Xóa lọc giá" onClick={() => {
                setPriceRange({ min: "", max: "" });
                onPriceRangeChange({ minPrice: "", maxPrice: "" });
              }}><FiX /></button>
            </span>
          )}
          <button type="button" className="clear-all-text" onClick={clearFilters}>Xóa bộ lọc</button>
        </div>
      )}
    </section>
  );
};

export default Toolbar;
