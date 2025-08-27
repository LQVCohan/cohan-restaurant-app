import React from "react";
import "./CategoryStats.scss";

const CategoryStats = ({ categories }) => {
  return (
    <div className="category-stats">
      <h3 className="category-stats__title">Số lượng món theo danh mục</h3>
      <div className="category-stats__grid">
        {categories.map((category) => (
          <div key={category.key} className="category-stats__item">
            <div className="category-stats__emoji">{category.emoji}</div>
            <div className="category-stats__name">{category.name}</div>
            <div className="category-stats__count">{category.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoryStats;
