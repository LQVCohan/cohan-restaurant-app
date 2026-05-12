import React from "react";
import {
  Search,
  Plus,
  Download,
  Calendar,
  Filter,
  LayoutList,
  LayoutGrid,
  X,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal, // Thay icon Filter cũ cho hiện đại hơn
} from "lucide-react";
import "./ActionsCard.scss";

const ActionsCard = ({
  filters,
  onFiltersChange,
  onCreatePromotion,
  onExport,
  viewMode = "list",
  onViewModeChange,
  counts = { all: 45, active: 12, scheduled: 5, expired: 20, draft: 8 },
}) => {
  const TABS = [
    { id: "all", label: "Tất cả" },
    { id: "active", label: "Đang chạy" },
    { id: "scheduled", label: "Sắp tới" },
    { id: "expired", label: "Đã xong" },
    { id: "draft", label: "Nháp" },
  ];

  const handleClearFilters = () => {
    onFiltersChange({ search: "", type: "all", date: "this_month" });
  };

  const hasActiveFilters = filters.search || filters.type !== "all";

  return (
    <div className="premium-actions-card">
      {/* --- SECTION 1: HEADER & TABS --- */}
      <div className="card-header">
        <div className="tabs-container">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-item ${
                filters.status === tab.id ? "active" : ""
              }`}
              onClick={() => onFiltersChange({ status: tab.id })}
            >
              <span className="tab-label">{tab.label}</span>
              {counts[tab.id] > 0 && (
                <span className="tab-badge">{counts[tab.id]}</span>
              )}
              {filters.status === tab.id && (
                <div className="active-indicator" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* --- SECTION 2: TOOLBAR CONTROLS --- */}
      <div className="card-toolbar">
        {/* LEFT: INPUTS */}
        <div className="toolbar-left">
          {/* Search Input - Modern Style */}
          <div
            className={`control-group search-group ${
              filters.search ? "has-value" : ""
            }`}
          >
            <Search size={18} className="icon-left" />
            <input
              type="text"
              placeholder="Tìm kiếm khuyến mãi..."
              value={filters.search}
              onChange={(e) => onFiltersChange({ search: e.target.value })}
            />
            {filters.search && (
              <button
                className="clear-btn"
                onClick={() => onFiltersChange({ search: "" })}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="divider" />

          {/* Filters */}
          <div className="filters-row">
            {/* Type Filter */}
            <div className="select-wrapper">
              <span className="select-icon">
                <SlidersHorizontal size={16} />
              </span>
              <select
                value={filters.type || "all"}
                onChange={(e) => onFiltersChange({ type: e.target.value })}
              >
                <option value="all">Tất cả loại</option>
                <option value="voucher">Coupon</option>
                <option value="item">Tặng món</option>
              </select>
              <ChevronDown size={14} className="chevron" />
            </div>

            {/* Date Filter */}
            <div className="select-wrapper">
              <span className="select-icon">
                <Calendar size={16} />
              </span>
              <select defaultValue="this_month">
                <option value="this_month">Tháng này</option>
                <option value="last_month">Tháng trước</option>
                <option value="custom">Tùy chọn...</option>
              </select>
              <ChevronDown size={14} className="chevron" />
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button className="btn-reset" onClick={handleClearFilters}>
                <RotateCcw size={14} />
                <span>Xóa lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: ACTIONS */}
        <div className="toolbar-right">
          {/* View Toggle (Segmented Control look) */}
          <div className="view-switcher">
            <button
              className={viewMode === "list" ? "active" : ""}
              onClick={() => onViewModeChange && onViewModeChange("list")}
              title="Danh sách"
            >
              <LayoutList size={18} />
            </button>
            <button
              className={viewMode === "grid" ? "active" : ""}
              onClick={() => onViewModeChange && onViewModeChange("grid")}
              title="Lưới"
            >
              <LayoutGrid size={18} />
            </button>
          </div>

          <div className="divider" />

          <button className="btn btn-secondary" onClick={onExport}>
            <Download size={18} />
            <span className="text">Xuất</span>
          </button>

          <button className="btn btn-primary" onClick={onCreatePromotion}>
            <Plus size={18} />
            <span className="text">Tạo mới</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionsCard;
