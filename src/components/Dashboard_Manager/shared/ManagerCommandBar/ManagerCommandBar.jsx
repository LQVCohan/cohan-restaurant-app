import React from "react";
import "./ManagerCommandBar.scss";

const ManagerCommandBar = ({ tabs = [], activeTab, onTabChange, searchValue = "", onSearchChange, searchPlaceholder = "Tìm kiếm...", filters, leftSlot, rightSlot, actions = [], viewMode, onViewModeChange, className = "" }) => (
  <section className={`manager-command-bar ${className}`.trim()}>
    {!!tabs.length && <div className="mcb-tabs">{tabs.map((tab) => <button key={tab.id} type="button" className={`mcb-tab ${activeTab === tab.id ? "is-active" : ""}`} onClick={() => onTabChange?.(tab.id)}>{tab.label}</button>)}</div>}
    <div className="mcb-controls">
      <div className="mcb-left">
        {leftSlot}
        {onSearchChange && <label className="mcb-search" aria-label="search"><span>🔍</span><input value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder} /></label>}
        {filters}
        {viewMode && onViewModeChange && <div className="mcb-view-toggle"><button type="button" className={viewMode === "grid" ? "is-active" : ""} onClick={() => onViewModeChange("grid")}>Grid</button><button type="button" className={viewMode === "list" ? "is-active" : ""} onClick={() => onViewModeChange("list")}>List</button></div>}
      </div>
      <div className="mcb-right">{actions.map((action) => <button key={action.label} type="button" className={`mcb-btn ${action.variant === "primary" ? "mcb-btn--primary" : ""}`} onClick={action.onClick} disabled={action.disabled}>{action.icon}<span>{action.label}</span></button>)}{rightSlot}</div>
    </div>
  </section>
);

export default ManagerCommandBar;
