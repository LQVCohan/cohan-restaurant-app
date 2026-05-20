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
    searchTerm || currentCategory || statusFilter || minPrice || maxPrice || inventoryFilter !== "all";

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

  const overviewCards = [
    {
      key: "items",
      icon: <FiBarChart2 />,
      label: "Món đang hiển thị",
      value: itemCount,
      hint: hasActiveFilters ? "Theo bộ lọc hiện tại" : "Tất cả kết quả",
    },
    {
      key: "categories",
      icon: <FiLayers />,
      label: "Danh mục món",
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
        return <FiCheck className="select-icon" style={{ opacity: 0.5 }} />;
    }
  };

  const handleAddDishCategory = onAddDishCategory || onAddCategory;
  const handleAddMenuGroup = onAddMenuGroup || onAddCategory;

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

          {onBulkPriceEdit && (
            <button className="btn btn-secondary" onClick={onBulkPriceEdit}>
              <FiDollarSign /> <span className="hide-mobile">Sửa giá</span>
            </button>
          )}
          {onCreatePromotion && (
            <button className="btn btn-secondary" onClick={onCreatePromotion}>
              <FiGift /> <span className="hide-mobile">Khuyến mãi</span>
            </button>
          )}
          {handleAddDishCategory && (
            <button
              className="btn btn-secondary"
              onClick={handleAddDishCategory}
            >
              <FiTag /> <span className="hide-mobile">Danh mục món</span>
            </button>
          )}
          {handleAddMenuGroup && (
            <button className="btn btn-primary" onClick={handleAddMenuGroup}>
              <FiFolderPlus />{" "}
              <span className="hide-mobile">Nhóm thực đơn</span>
            </button>
          )}
        </div>
      </div>

      <div className="toolbar-overview-cards">
        {overviewCards.map((card) => (
          <div key={card.key} className="toolbar-overview-card">
            <span className="toolbar-overview-card__icon">{card.icon}</span>
            <span className="toolbar-overview-card__content">
              <span className="toolbar-overview-card__label">{card.label}</span>
              <strong className="toolbar-overview-card__value">{card.value}</strong>
              <small className="toolbar-overview-card__hint">{card.hint}</small>
            </span>
          </div>
        ))}
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
            <select
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
            className={`btn-filter-toggle ${showFilters || minPrice || maxPrice ? "active" : ""}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <FiFilter /> Lọc giá
          </button>
        </div>

        <div className="inventory-filter-row">
          {[
            ["all", "Tất cả"],
            ["low_stock", "Sắp hết"],
            ["out_of_stock", "Hết nguyên liệu"],
            ["needs_check", "Cần kiểm kho"],
            ["not_tracked", "Chưa tracking recipe"],
          ].map(([key, label]) => (
            <button key={key} className={`inventory-chip ${inventoryFilter === key ? "active" : ""}`} onClick={() => onInventoryFilterChange?.(key)} type="button">
              <span>{label}</span>
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
              Danh mục món đã chọn <FiX onClick={() => onCategoryChange("")} />
            </span>
          )}
          {statusFilter && (
            <span className="chip">
              {STATUS_LABELS[statusFilter] || statusFilter}
              <FiX onClick={() => onStatusFilterChange("")} />
            </span>
          )}
          {inventoryFilter !== "all" && (
            <span className="chip">
              {{ low_stock: "Sắp hết", out_of_stock: "Hết nguyên liệu", needs_check: "Cần kiểm kho", not_tracked: "Chưa tracking recipe" }[inventoryFilter] || inventoryFilter}
              <FiX onClick={() => onInventoryFilterChange?.("all")} />
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
