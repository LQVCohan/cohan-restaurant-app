import React from "react";
import Card from "../../../../common/Card";
import "./Tabs.scss";

const Tabs = ({ tabs, activeTab, onTabChange }) => {
  return (
    <Card className="tabs-card">
      <div className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </Card>
  );
};

export default Tabs;
