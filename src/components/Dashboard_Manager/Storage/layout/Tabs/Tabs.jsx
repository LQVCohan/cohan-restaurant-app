// src/components/Dashboard_Manager/Storage/layout/Tabs/Tabs.jsx
import React from "react";
import "./Tabs.scss";
import "../../StorageExperiencePolish.css";

const Tabs = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="sm-tabs-container" role="tablist" aria-label="Nhóm chức năng kho">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`sm-tab-item ${isActive ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
          >
            {/* Render Icon nếu có */}
            {tab.icon && <span className="tab-icon">{tab.icon}</span>}

            <span className="tab-label">{tab.label}</span>

            {/* Dấu chấm nhỏ trang trí khi active (Optional) */}
            {isActive && <span className="active-dot" />}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;
