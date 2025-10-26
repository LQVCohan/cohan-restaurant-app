import React from "react";
import "./CategoryTabs.scss";

export default function CategoryTabs({ categories = [], activeId, onChange }) {
  return (
    <div className="category-tabs-container">
      <div className="category-tabs">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`category-tab ${activeId === c.id ? "active" : ""}`}
            onClick={() => onChange?.(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </div>
  );
}
