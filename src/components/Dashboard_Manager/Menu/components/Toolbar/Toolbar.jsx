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
  FiPauseCircle,
  FiFolderPlus,
  FiBarChart2,
  FiLayers,
  FiTrendingUp,
} from "react-icons/fi";
import "./Toolbar.scss";

const STATUS_OPTIONS = [
  { value: "available", label: "Sẵn sàng" },
  { value: "unavailable", label: "Tạm dừng" },
  { value: "out_of_stock", label: "Hết hàng" },
  { value: "hidden", label: "Ẩn khỏi menu" },
];

const STATUS_LABELS = STATUS_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

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
  // Backward compatibility for old callers.
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
  operationStats = null,
  showMetrics = true,
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
    if (onSortChange) onSortChange("default");
    setPriceRange({ min: "", max: "" });
    onPriceRangeChange({ minPrice: "", maxPrice: "" });
  };

  const hasActiveFilters =
    searchTerm || currentCategory || statusFilter || minPrice || maxPrice || inventoryFilter !== "all" || forYouMetadataFilter !== "all";

  const formatCurrency = (val) =>
    val ? parseInt(val, 10).toLocaleString("vi-VN") + "đ" : "";

  const getSelectedCategoryName = () => {
    if (!currentCategory) return "Tất cả";
    return (
      categories.find((cat) => String(cat.id) === String(currentCategory))
        ?.name || "Đã chọn"
    );
  };

  const getPriceRangeLabel = () => {
    if (!minPrice && !maxPrice) return "Chưa giới hạn";
    return `${formatCurrency(minPrice) || "0"} - ${formatCurrency(maxPrice) || "∞"}`;
  };

  const defaultOverviewCards = [
    {
      key: "items",
      icon: <FiBarChart2 />,
      label: "Tổng món",
      value: itemCount,
      hint: hasActiveFilters ? "Theo bộ lọc hiện tại" : "Tất cả kết quả",
    },
    {
      key: "categories",
      icon: <FiLayers />,
      label: "Danh mục",
      value: categories.length,
      hint: currentCategory ? getSelectedCategoryName() : "Có thể phân loại món",
    },
    {
      key: "status",
      icon: <FiCheck />,
      label: "Trạng thái lọc",
      value: statusFilter ? STATUS_LABELS[statusFilter] || statusFilter : "Tất cả",
      hint: statusFilter ? "Đang áp dụng" : "Không giới hạn",
    },
    {
      key: "price",
      icon: <FiTrendingUp />,
      label: "Khoảng giá",
      value: getPriceRangeLabel(),
      hint: minPrice || maxPrice ? "Đang lọc giá" : "Chưa áp dụng lọc giá",
    },
  ];

  const overviewCards = Array.isArray(operationStats) && operationStats.length
    ? operationStats.map((card) => ({
        ...card,
        icon:
          card.key === "selling" ? <FiCheck /> :
          card.key === "paused" ? <FiPauseCircle /> :
          card.key === "categories" ? <FiLayers /> :
          <FiBarChart2 />,
      }))
    : defaultOverviewCards;

  const renderStatusIcon = () => {
    switch (statusFilter) {
      case "available":
        return <FiCheck className="select-icon" />;
      case "unavailable":
        return <FiPauseCircle className="select-icon" />;
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
    <section className="toolbar-container" aria-label="Bộ lọc quản lý món ăn">
      <div className="toolbar-top">
        <div className="search-wrapper">
          <FiSearch className="search-icon" />
          <label className="toolbar-sr-label" htmlFor="menu-search-input">Tìm món</label>
          <input
            id="menu-search-input"
            type="text"
            className="search-input"
            placeholder="Tìm món theo tên hoặc mô tả..."
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
              aria-label="Hiển thị dạng lưới"
              title="Xem dạng Lưới"
            >
              <FiGrid />
            </button>
            <button
              type="button"
              className={`toggle-btn ${currentView === "list" ? "active" : ""}`}
              onClick={() => onViewChange("list")}
              aria-label="Hiển thị dạng danh sách"
              title="Xem dạng Danh sách"
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAddDishCategory}
            >
              <FiTag /> <span className="hide-mobile">Danh mục món</span>
            </button>
          )}
          {handleAddMenuGroup && (
            <button type="button" className="btn btn-primary" onClick={handleAddMenuGroup}>
              <FiFolderPlus />{" "}
              <span className="hide-mobile">Nhóm thực đơn</span>
            </button>
          )}
        </div>
      </div>

      {showMetrics && (
        <div className="toolbar-metric-strip">
          {overviewCards.map((card) => (
            <div key={card.key} className="toolbar-metric-pill">
              <span className="toolbar-metric-pill__icon">{card.icon}</span>
              <span className="toolbar-metric-pill__content">
                <span className="toolbar-metric-pill__label">{card.label}</span>
                <strong className="toolbar-metric-pill__value">{card.value}</strong>
                <small className="toolbar-metric-pill__hint">{card.hint}</small>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="toolbar-filters">
        <div className="filter-row">
          <div className="select-wrapper">
            <FiSliders className="select-icon" />
            <label className="toolbar-sr-label" htmlFor="menu-sort-select">Sắp xếp món</label>
            <select
              id="menu-sort-select"
              aria-label="Sắp xếp món"
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
            <label className="toolbar-sr-label" htmlFor="menu-category-select">Danh mục</label>
            <select
              id="menu-category-select"
              aria-label="Lọc theo danh mục"
              className={`custom-select ${currentCategory ? "active" : ""}`}
              value={currentCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">Tất cả danh mục món</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <FiChevronDown className="select-arrow" />
          </div>

          <div className="select-wrapper">
            {renderStatusIcon()}
            <label className="toolbar-sr-label" htmlFor="menu-status-select">Trạng thái bán</label>
            <select
              id="menu-status-select"
              aria-label="Lọc theo trạng thái bán hoặc hiển thị"
              className={`custom-select ${statusFilter ? "active" : ""}`}
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <FiChevronDown className="select-arrow" />
          </div>

          <button
            type="button"
            className={`btn-filter-toggle ${showFilters || minPrice || maxPrice ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            <FiFilter /> Lọc giá
          </button>
        </div>


        <div className="toolbar-for-you-filter">
          <span className="toolbar-for-you-filter__label">Khẩu vị</span>
          {[
            ["all", "Tất cả"],
            ["missing", `Chưa khai báo (${forYouMetadataCounts.missing || 0})`],
            ["ready", `Đã khai báo (${forYouMetadataCounts.ready || 0})`],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`inventory-chip ${forYouMetadataFilter === key ? "active" : ""}`}
              onClick={() => onForYouMetadataFilterChange?.(key)}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="inventory-filter-row">
          {[
            ["all", "Tất cả"],
            ["low_stock", "Sắp hết"],
            ["out_of_stock", "Hết nguyên liệu"],
            ["needs_check", "Cần kiểm kho"],
            ["not_tracked", "Chưa tracking recipe"],
          ].map(([key, label]) => (
            <button key={key} className={`inventory-chip ${inventoryFilter === key ? "active" : ""}`} onClick={() => onInventoryFilterChange?.(key)} type="button" title={label}>
              <span>{key === "not_tracked" ? <><span className="desktop-label">{label}</span><span className="mobile-label">Chưa tracking</span></> : label}</span>
              <span className="count">{inventoryFilterCounts[key] || 0}</span>
            </button>
          ))}
        </div>

        <div className="result-count">
          Hiển thị <strong>{itemCount}</strong> kết quả
        </div>
      </div>

      <div className={`advanced-panel ${showFilters ? "open" : ""}`}>
        <div className="price-inputs">
          <label>Khoảng giá (VNĐ):</label>
          <input
            id="menu-min-price"
            type="number"
            aria-label="Giá thấp nhất"
            placeholder="Thấp nhất"
            value={priceRange.min}
            onChange={(e) =>
              setPriceRange((p) => ({ ...p, min: e.target.value }))
            }
          />
          <span className="separator">-</span>
          <input
            id="menu-max-price"
            type="number"
            aria-label="Giá cao nhất"
            placeholder="Cao nhất"
            value={priceRange.max}
            onChange={(e) =>
              setPriceRange((p) => ({ ...p, max: e.target.value }))
            }
          />
          <button type="button" className="btn-apply" onClick={handlePriceRangeSubmit}>
            Áp dụng
          </button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="active-chips-area">
          <span className="label">Đang lọc:</span>
          {searchTerm && (
            <span className="chip">Tìm: "{searchTerm}" <button type="button" className="chip-x" aria-label="Xóa lọc tìm kiếm" title="Xóa lọc tìm kiếm" onClick={() => onSearchChange("")}><FiX /></button></span>
          )}
          {currentCategory && (
            <span className="chip">Danh mục món đã chọn <button type="button" className="chip-x" aria-label="Xóa lọc danh mục" title="Xóa lọc danh mục" onClick={() => onCategoryChange("")}><FiX /></button></span>
          )}
          {statusFilter && (
            <span className="chip">{STATUS_LABELS[statusFilter] || statusFilter}<button type="button" className="chip-x" aria-label="Xóa lọc trạng thái" title="Xóa lọc trạng thái" onClick={() => onStatusFilterChange("")}><FiX /></button></span>
          )}
          {forYouMetadataFilter !== "all" && (
            <span className="chip">{forYouMetadataFilter === "missing" ? "Chưa khai báo khẩu vị" : "Đã khai báo khẩu vị"}<button type="button" className="chip-x" aria-label="Xóa lọc khẩu vị" title="Xóa lọc khẩu vị" onClick={() => onForYouMetadataFilterChange?.("all")}><FiX /></button></span>
          )}
          {inventoryFilter !== "all" && (
            <span className="chip">{{ low_stock: "Sắp hết", out_of_stock: "Hết nguyên liệu", needs_check: "Cần kiểm kho", not_tracked: "Chưa tracking recipe" }[inventoryFilter] || inventoryFilter}<button type="button" className="chip-x" aria-label="Xóa lọc tồn kho" title="Xóa lọc tồn kho" onClick={() => onInventoryFilterChange?.("all")}><FiX /></button></span>
          )}
          {(minPrice || maxPrice) && (
            <span className="chip">
              Giá: {formatCurrency(minPrice) || "0"} -{" "}
              {formatCurrency(maxPrice) || "∞"}
              <button type="button" className="chip-x" aria-label="Xóa lọc giá" title="Xóa lọc giá" onClick={() => {
                  setPriceRange({ min: "", max: "" });
                  onPriceRangeChange({ minPrice: "", maxPrice: "" });
                }}><FiX /></button>
            </span>
          )}
          <button type="button" className="clear-all-text" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </div>
      )}
    </section>
  );
};

export default Toolbar;
