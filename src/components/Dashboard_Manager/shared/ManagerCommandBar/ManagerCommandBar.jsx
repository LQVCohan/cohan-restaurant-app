import React from "react";
import "./ManagerCommandBar.scss";

const ManagerCommandBar = ({
  tabs = [],
  activeTab,
  onTabChange,
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Tìm kiếm...",
  searchAriaLabel = "Tìm kiếm",
  filters,
  leftSlot,
  rightSlot,
  actions = [],
  viewMode,
  onViewModeChange,
  className = "",
}) => {
  return (
    <section className={`manager-command-bar ${className}`.trim()}>
      {!!tabs.length && (
        <div className="mcb-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`mcb-tab ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => onTabChange?.(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="mcb-controls">
        <div className="mcb-left">
          {leftSlot}

          {onSearchChange && (
            <label className="mcb-search" aria-label={searchAriaLabel}>
              <span>🔍</span>
              <input
                aria-label={searchAriaLabel}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
              />
            </label>
          )}

          {filters}

          {viewMode && onViewModeChange && (
            <div className="mcb-view-toggle">
              <button
                type="button"
                className={viewMode === "grid" ? "is-active" : ""}
                onClick={() => onViewModeChange("grid")}
              >
                Lưới
              </button>
              <button
                type="button"
                className={viewMode === "list" ? "is-active" : ""}
                onClick={() => onViewModeChange("list")}
              >
                Danh sách
              </button>
            </div>
          )}
        </div>

        <div className="mcb-right">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`mcb-btn ${action.variant === "primary" ? "mcb-btn--primary" : ""}`}
              onClick={action.onClick}
              disabled={action.disabled || action.loading}
              aria-busy={action.loading ? "true" : undefined}
              title={action.title || action.label}
              aria-label={action.ariaLabel || action.label}
            >
              {action.icon}
              <span>{action.loading ? "Đang xử lý..." : action.label}</span>
            </button>
          ))}
          {rightSlot}
        </div>
      </div>
    </section>
  );
};

export default ManagerCommandBar;
